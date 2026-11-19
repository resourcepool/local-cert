import 'server-only';
import { ApiError } from '@/lib/http';
import * as route53 from './route53';
import { preflightZone as preflightRoute53, type PreflightCheck, type PreflightResult } from './preflight';
import { DriverError, type DnsDriver, type DriverConfig } from './drivers/types';
import { ovh } from './drivers/ovh';
import { gandi } from './drivers/gandi';
import { godaddy } from './drivers/godaddy';
import { gcp } from './drivers/gcp';
import type { RemoteProviderType } from './provider-types';

/**
 * Everything the rest of the app does to a DNS zone, whoever hosts it.
 *
 * Callers hold a ZoneConfig (built by lib/dns/providers.ts from a domain) and
 * use these functions without knowing the host. Route53 zones go to the
 * original implementation; every other host goes through its driver, with the
 * behaviour Route53 gets from its API — provenance markers, ownership,
 * authoritative-NS polling, a permission preflight — rebuilt here once.
 */

export type { ZoneRecord } from './route53';
export { MANAGED_TAG, sleep } from './route53';
export type { PreflightCheck, PreflightResult } from './preflight';

export type AwsZone = route53.ZoneConfig & { kind?: 'aws' };

export interface RemoteZone {
  kind: RemoteProviderType;
  zoneId: string;
  /** provider settings and secrets, merged */
  cfg: DriverConfig;
}

export type ZoneConfig = AwsZone | RemoteZone;

export const DRIVERS: Record<RemoteProviderType, DnsDriver> = { ovh, gandi, godaddy, gcp };

const isRemote = (zone: ZoneConfig): zone is RemoteZone =>
  zone.kind !== undefined && zone.kind !== 'aws';

/** Driver failures become clean 502s instead of anonymous 500s. */
async function upstream<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof DriverError) throw new ApiError('upstream_error', err.message);
    throw err;
  }
}

const clampTtl = (zone: RemoteZone, ttl: number) => Math.max(ttl, DRIVERS[zone.kind].minTtl);

/** Returns a change id to pass to waitForSync; hosts without change tracking return ''. */
export async function upsertRecord(
  zone: ZoneConfig,
  name: string,
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT',
  values: string[],
  ttl: number,
): Promise<string> {
  if (!isRemote(zone)) return route53.upsertRecord(zone, name, type, values, ttl);
  const driver = DRIVERS[zone.kind];
  return upstream(async () => {
    await driver.setRrset(zone.cfg, zone.zoneId, name, type, values, clampTtl(zone, ttl));
    // No atomic batch here: the record goes first, so a failure in between
    // leaves an unmarked record (visible, harmless) rather than a marker
    // claiming something that does not exist.
    const marker = route53.markerNameFor(name);
    if (marker) {
      await driver.setRrset(zone.cfg, zone.zoneId, marker, 'TXT', [route53.MANAGED_TAG], clampTtl(zone, ttl));
    }
    return '';
  });
}

export async function deleteRecord(
  zone: ZoneConfig,
  name: string,
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT',
  values: string[],
  ttl: number,
): Promise<void> {
  if (!isRemote(zone)) return route53.deleteRecord(zone, name, type, values, ttl);
  const driver = DRIVERS[zone.kind];
  await upstream(async () => {
    await driver.deleteRrset(zone.cfg, zone.zoneId, name, type);
    const marker = route53.markerNameFor(name);
    if (marker) await driver.deleteRrset(zone.cfg, zone.zoneId, marker, 'TXT');
  });
}

export async function waitForSync(zone: ZoneConfig, changeId: string, timeoutMs?: number): Promise<void> {
  // Other hosts apply a write before answering, or give no way to track it;
  // waitForTxtPropagation is what actually proves a challenge is visible.
  if (isRemote(zone)) return;
  return route53.waitForSync(zone, changeId, timeoutMs);
}

export async function listRecords(zone: ZoneConfig): Promise<route53.ZoneRecord[]> {
  if (!isRemote(zone)) return route53.listRecords(zone);
  const rows = await upstream(() => DRIVERS[zone.kind].listRrsets(zone.cfg, zone.zoneId));
  return route53.withOwnership(rows);
}

export async function waitForTxtPropagation(
  zone: ZoneConfig,
  name: string,
  expected: string,
  timeoutMs?: number,
  onTick?: (msg: string) => void,
): Promise<void> {
  if (!isRemote(zone)) return route53.waitForTxtPropagation(zone, name, expected, timeoutMs, onTick);
  const ns = await upstream(() => DRIVERS[zone.kind].nameservers(zone.cfg, zone.zoneId));
  if (ns.length === 0) throw new ApiError('upstream_error', 'The DNS host reports no nameserver for this zone');
  return route53.pollTxt(ns, name, expected, timeoutMs, onTick);
}

/* -------------------------------------------------------------- preflight */

const WHY: Record<string, string> = {
  read_zone: 'Finding the zone, its apex and the nameservers to poll during DNS-01.',
  read_records: 'Listing records and checking whether a name is already taken.',
  change_txt: 'DNS-01 is built on TXT records — nothing can be issued without it.',
};

function explain(err: unknown): string {
  if (err instanceof DriverError) {
    return err.denied ? `refused by the host — ${err.message}` : err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Unlike Route53, these hosts offer no way to test write access without
 * writing: the probe creates a TXT record under a throwaway name and removes
 * it straight away. Nothing existing is touched.
 */
async function preflightRemote(zone: RemoteZone): Promise<PreflightResult> {
  const driver = DRIVERS[zone.kind];
  const checks: PreflightCheck[] = [];
  let zoneName: string | null = null;

  const step = async (id: string, label: string, fn: () => Promise<void>) => {
    try {
      await fn();
      checks.push({ id, label, required: true, ok: true, note: 'authorized' });
    } catch (err) {
      checks.push({ id, label, required: true, ok: false, note: explain(err), why: WHY[id] });
    }
  };
  const skipped = (id: string, label: string) =>
    checks.push({
      id,
      label,
      required: true,
      ok: false,
      note: 'skipped — the zone could not be read',
      why: WHY[id],
    });

  await step('read_zone', 'Lecture de la zone', async () => {
    zoneName = await driver.zoneName(zone.cfg, zone.zoneId);
    const ns = await driver.nameservers(zone.cfg, zone.zoneId);
    if (ns.length === 0) throw new Error('the host reports no nameserver for this zone');
  });

  const apex = zoneName as string | null;
  if (!apex) {
    skipped('read_records', 'Lecture des enregistrements');
    skipped('change_txt', 'Écriture et suppression (TXT)');
  } else {
    const probe = `_localcert-preflight-${Date.now().toString(36)}.${apex}`;
    await step('read_records', 'Lecture des enregistrements', async () => {
      await driver.getRrset(zone.cfg, zone.zoneId, probe, 'TXT');
    });
    await step('change_txt', 'Écriture et suppression (TXT)', async () => {
      await driver.setRrset(zone.cfg, zone.zoneId, probe, 'TXT', ['local-cert-preflight'], driver.minTtl);
      await driver.deleteRrset(zone.cfg, zone.zoneId, probe, 'TXT');
    });
  }

  const failures = checks.filter((c) => c.required && !c.ok);
  return { zoneName, checks, failures, ok: failures.length === 0 };
}

export async function preflightZone(zone: ZoneConfig): Promise<PreflightResult> {
  return isRemote(zone) ? preflightRemote(zone) : preflightRoute53(zone);
}

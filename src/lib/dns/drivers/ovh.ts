import { createHash } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { DriverError, quoteTxt, relativeName, request, unquoteTxt, type DnsDriver, type DriverConfig, type DriverZone, type Rrset } from './types';

/**
 * OVHcloud API v1 — https://api.ovh.com/console/#/domain/zone. The zone id is
 * the zone name. OVH stores individual records rather than record sets, and a
 * change only goes live after POST /refresh.
 */

const ENDPOINTS: Record<string, string> = {
  'ovh-eu': 'https://eu.api.ovh.com/1.0',
  'ovh-ca': 'https://ca.api.ovh.com/1.0',
  'ovh-us': 'https://api.us.ovhcloud.com/1.0',
};

function base(cfg: DriverConfig): string {
  const url = ENDPOINTS[cfg.endpoint || 'ovh-eu'];
  if (!url) throw new DriverError(`Unknown OVH endpoint "${cfg.endpoint}"`, 0);
  return url;
}

/** server clock minus ours, per endpoint: the signature is rejected on drift */
const clockDelta = new Map<string, number>();

async function timestamp(root: string): Promise<number> {
  let delta = clockDelta.get(root);
  if (delta === undefined) {
    const remote = Number(await request('OVH', `${root}/auth/time`));
    delta = remote - Math.floor(Date.now() / 1000);
    clockDelta.set(root, delta);
  }
  return Math.floor(Date.now() / 1000) + delta;
}

async function call(
  cfg: DriverConfig,
  method: string,
  path: string,
  payload?: unknown,
  okStatuses?: number[],
): Promise<unknown> {
  const root = base(cfg);
  const url = `${root}${path}`;
  const body = payload === undefined ? '' : JSON.stringify(payload);
  const ts = await timestamp(root);
  const signature =
    '$1$' +
    createHash('sha1')
      .update([cfg.application_secret, cfg.consumer_key, method, url, body, ts].join('+'))
      .digest('hex');
  return request('OVH', url, {
    method,
    body: body || undefined,
    okStatuses,
    headers: {
      'content-type': 'application/json',
      'x-ovh-application': cfg.application_key,
      'x-ovh-consumer': cfg.consumer_key,
      'x-ovh-timestamp': String(ts),
      'x-ovh-signature': signature,
    },
  });
}

const enc = encodeURIComponent;

interface OvhRecord {
  id: number;
  fieldType: string;
  subDomain: string;
  target: string;
  ttl: number;
}

async function ids(cfg: DriverConfig, zone: string, sub?: string, type?: string): Promise<number[]> {
  const query = new URLSearchParams();
  if (type) query.set('fieldType', type);
  if (sub !== undefined) query.set('subDomain', sub);
  const qs = query.toString();
  return (await call(cfg, 'GET', `/domain/zone/${enc(zone)}/record${qs ? `?${qs}` : ''}`)) as number[];
}

async function records(cfg: DriverConfig, zone: string, list: number[]): Promise<OvhRecord[]> {
  const out: OvhRecord[] = [];
  // Ten at a time: one request per record is all the API offers.
  for (let i = 0; i < list.length; i += 10) {
    const chunk = await Promise.all(
      list
        .slice(i, i + 10)
        .map((id) => call(cfg, 'GET', `/domain/zone/${enc(zone)}/record/${id}`) as Promise<OvhRecord>),
    );
    out.push(...chunk);
  }
  return out;
}

function group(rows: OvhRecord[], zone: string): Rrset[] {
  const sets = new Map<string, Rrset>();
  for (const r of rows) {
    const key = `${r.subDomain}|${r.fieldType}`;
    const set = sets.get(key) ?? {
      name: r.subDomain ? `${r.subDomain}.${zone}` : zone,
      type: r.fieldType,
      ttl: r.ttl || null,
      values: [],
    };
    set.values.push(r.fieldType === 'TXT' ? unquoteTxt(r.target) : r.target);
    sets.set(key, set);
  }
  return [...sets.values()];
}

async function clear(cfg: DriverConfig, zone: string, sub: string, type: string): Promise<number> {
  const existing = await ids(cfg, zone, sub, type);
  for (const id of existing) {
    await call(cfg, 'DELETE', `/domain/zone/${enc(zone)}/record/${id}`, undefined, [404]);
  }
  return existing.length;
}

const refresh = (cfg: DriverConfig, zone: string) =>
  call(cfg, 'POST', `/domain/zone/${enc(zone)}/refresh`);

const host = (name: string) => name.toLowerCase().replace(/\.$/, '');

/**
 * An OVH account keeps a zone for every domain it ever hosted, including those
 * whose registrar now points elsewhere. Compares the nameservers OVH assigned
 * to the zone with the ones the public DNS delegates the name to. Reading the
 * zone is covered by the GET /domain/zone/* right the provider already has;
 * the public lookup needs none. Anything inconclusive is reported as unknown,
 * never as "not delegated".
 */
async function delegation(cfg: DriverConfig, name: string): Promise<DriverZone> {
  const zone: DriverZone = { id: name, name, delegated: null };
  let assigned: string[];
  try {
    const info = (await call(cfg, 'GET', `/domain/zone/${enc(name)}`)) as { nameServers?: string[] };
    assigned = (info.nameServers ?? []).map(host);
  } catch {
    return zone;
  }
  if (assigned.length === 0) return zone;
  try {
    const found = (await new Resolver({ timeout: 3000, tries: 2 }).resolveNs(name)).map(host);
    zone.publicNameservers = found;
    zone.delegated = found.some((ns) => assigned.includes(ns));
  } catch (err) {
    // The name does not exist or has no NS at all: not delegated to anyone.
    const code = (err as { code?: string }).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      zone.publicNameservers = [];
      zone.delegated = false;
    }
  }
  return zone;
}

export const ovh: DnsDriver = {
  minTtl: 60,

  async listZones(cfg, opts) {
    const names = (await call(cfg, 'GET', '/domain/zone')) as string[];
    if (!opts?.delegation) return names.map((name) => ({ id: name, name }));
    const out: DriverZone[] = [];
    for (let i = 0; i < names.length; i += 8) {
      out.push(...(await Promise.all(names.slice(i, i + 8).map((name) => delegation(cfg, name)))));
    }
    return out;
  },

  async zoneName(cfg, zoneId) {
    const zone = (await call(cfg, 'GET', `/domain/zone/${enc(zoneId)}`)) as { name?: string };
    return zone.name ?? zoneId;
  },

  async nameservers(cfg, zoneId) {
    const zone = (await call(cfg, 'GET', `/domain/zone/${enc(zoneId)}`)) as { nameServers?: string[] };
    return zone.nameServers ?? [];
  },

  async getRrset(cfg, zoneId, fqdn, type) {
    const sub = relativeName(fqdn, zoneId);
    const rows = await records(cfg, zoneId, await ids(cfg, zoneId, sub, type));
    return group(rows, zoneId)[0] ?? null;
  },

  async setRrset(cfg, zoneId, fqdn, type, values, ttl) {
    const sub = relativeName(fqdn, zoneId);
    await clear(cfg, zoneId, sub, type);
    for (const value of values) {
      await call(cfg, 'POST', `/domain/zone/${enc(zoneId)}/record`, {
        fieldType: type,
        subDomain: sub,
        target: type === 'TXT' ? quoteTxt(value) : value,
        ttl,
      });
    }
    await refresh(cfg, zoneId);
  },

  async deleteRrset(cfg, zoneId, fqdn, type) {
    const removed = await clear(cfg, zoneId, relativeName(fqdn, zoneId), type);
    if (removed > 0) await refresh(cfg, zoneId);
  },

  async listRrsets(cfg, zoneId) {
    return group(await records(cfg, zoneId, await ids(cfg, zoneId)), zoneId);
  },
};

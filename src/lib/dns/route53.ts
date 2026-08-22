import 'server-only';
import {
  Route53Client,
  ChangeResourceRecordSetsCommand,
  GetChangeCommand,
  ListResourceRecordSetsCommand,
  GetHostedZoneCommand,
  type Change,
  type RRType,
} from '@aws-sdk/client-route-53';
import { Resolver } from 'node:dns/promises';
import { ApiError } from '@/lib/http';

export interface ZoneConfig {
  zoneId: string;
  region: string;
  roleArn: string | null;
}

/**
 * Provenance marker for everything this service creates.
 *
 * Route53 has NO tag facility for resource record sets — `ChangeTagsForResource`
 * only accepts `hostedzone` and `healthcheck`. So provenance is stamped the two
 * ways a record set actually allows:
 *
 *   1. the ChangeBatch `Comment`, which lands in the change history and in the
 *      CloudTrail event for every write, and
 *   2. a companion TXT record `_local-cert.<name>` carrying the marker, written
 *      in the same atomic ChangeBatch as the record itself.
 *
 * (2) is what makes ownership queryable after the fact — a plain `dig` tells you
 * whether local-cert owns a name. Set TAG_RECORDS=0 to write only (1).
 */
export const MANAGED_TAG = 'managed-with-local-cert';

const MARKER_PREFIX = '_local-cert.';

function markerEnabled(): boolean {
  return process.env.TAG_RECORDS !== '0';
}

/**
 * Names that get no companion marker: wildcards (Route53 only accepts "*" as
 * the leftmost label, so "_local-cert.*.x" is invalid), the markers themselves,
 * and the ephemeral ACME challenge records — those live for ~2 minutes and are
 * covered by the ChangeBatch comment.
 */
function markerNameFor(name: string): string | null {
  if (!markerEnabled()) return null;
  if (name.includes('*')) return null;
  if (name.startsWith(MARKER_PREFIX)) return null;
  if (name.startsWith('_acme-challenge.')) return null;
  return `${MARKER_PREFIX}${name}`;
}

function comment(detail: string): string {
  // Route53 caps Comment at 256 characters.
  return `${MANAGED_TAG} | ${detail}`.slice(0, 256);
}

const clients = new Map<string, Route53Client>();

export function clientFor(zone: ZoneConfig): Route53Client {
  const cacheKey = `${zone.region}|${zone.roleArn ?? '-'}`;
  const existing = clients.get(cacheKey);
  if (existing) return existing;

  // Credentials come from the standard chain (env, profile, IRSA, instance role).
  // A per-zone role is assumed lazily when aws_role_arn is set.
  const base = { region: zone.region };
  const client = zone.roleArn
    ? new Route53Client({
        ...base,
        credentials: async () => {
          const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts');
          const sts = new STSClient({ region: zone.region });
          const res = await sts.send(
            new AssumeRoleCommand({
              RoleArn: zone.roleArn!,
              RoleSessionName: 'local-cert',
              DurationSeconds: 3600,
            }),
          );
          const c = res.Credentials;
          if (!c?.AccessKeyId || !c.SecretAccessKey) throw new Error('AssumeRole returned no credentials');
          return {
            accessKeyId: c.AccessKeyId,
            secretAccessKey: c.SecretAccessKey,
            sessionToken: c.SessionToken,
            expiration: c.Expiration,
          };
        },
      })
    : new Route53Client(base);

  clients.set(cacheKey, client);
  return client;
}

function fqdn(name: string): string {
  return name.endsWith('.') ? name : `${name}.`;
}

async function applyChanges(
  zone: ZoneConfig,
  changes: Change[],
  detail: string,
): Promise<string> {
  const res = await clientFor(zone).send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zone.zoneId,
      ChangeBatch: { Comment: comment(detail), Changes: changes },
    }),
  );
  const id = res.ChangeInfo?.Id;
  if (!id) throw new ApiError('upstream_error', 'Route53 returned no ChangeId');
  return id;
}

function recordSet(name: string, type: RRType, values: string[], ttl: number) {
  return {
    Name: fqdn(name),
    Type: type,
    TTL: ttl,
    ResourceRecords: values.map((v) => ({
      Value: type === 'TXT' ? `"${v.replace(/"/g, '\\"')}"` : v,
    })),
  };
}

export async function upsertRecord(
  zone: ZoneConfig,
  name: string,
  type: RRType,
  values: string[],
  ttl: number,
): Promise<string> {
  const changes: Change[] = [
    { Action: 'UPSERT', ResourceRecordSet: recordSet(name, type, values, ttl) },
  ];

  // Same ChangeBatch as the record itself: the marker can never be left behind
  // by a partial write, and it costs no extra Route53 round trip.
  const marker = markerNameFor(name);
  if (marker) {
    changes.push({
      Action: 'UPSERT',
      ResourceRecordSet: recordSet(marker, 'TXT', [MANAGED_TAG], ttl),
    });
  }

  return applyChanges(zone, changes, `UPSERT ${type} ${name}`);
}

export async function deleteRecord(
  zone: ZoneConfig,
  name: string,
  type: RRType,
  values: string[],
  ttl: number,
): Promise<void> {
  await bestEffortDelete(zone, recordSet(name, type, values, ttl), `DELETE ${type} ${name}`);

  // Separate call, not the same batch: Route53 rejects an entire ChangeBatch if
  // any DELETE targets an absent RRset, so a missing marker must not take the
  // real deletion down with it.
  const marker = markerNameFor(name);
  if (marker) {
    await bestEffortDelete(
      zone,
      recordSet(marker, 'TXT', [MANAGED_TAG], ttl),
      `DELETE marker ${marker}`,
    );
  }
}

async function bestEffortDelete(
  zone: ZoneConfig,
  ResourceRecordSet: ReturnType<typeof recordSet>,
  detail: string,
): Promise<void> {
  try {
    await applyChanges(zone, [{ Action: 'DELETE', ResourceRecordSet }], detail);
  } catch (err) {
    // DELETE of an already-absent RRset is a hard error in Route53; cleanup is
    // best-effort and must never fail the caller.
    const msg = (err as Error).message ?? '';
    if (!/not found|does not exist|InvalidChangeBatch/i.test(msg)) throw err;
  }
}

export async function waitForSync(zone: ZoneConfig, changeId: string, timeoutMs = 120_000): Promise<void> {
  const client = clientFor(zone);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await client.send(new GetChangeCommand({ Id: changeId }));
    if (res.ChangeInfo?.Status === 'INSYNC') return;
    await sleep(3000);
  }
  throw new ApiError('upstream_error', `Route53 change ${changeId} did not reach INSYNC in time`);
}

export interface ZoneRecord {
  name: string;
  type: string;
  ttl: number | null;
  values: string[];
  /** true when a companion _local-cert marker claims this name */
  managed: boolean;
  /** true when this row is itself a provenance marker */
  marker: boolean;
}

export async function listRecords(zone: ZoneConfig): Promise<ZoneRecord[]> {
  const out: Array<Omit<ZoneRecord, 'managed' | 'marker'>> = [];
  let startName: string | undefined;
  let startType: RRType | undefined;
  for (;;) {
    const res = await clientFor(zone).send(
      new ListResourceRecordSetsCommand({
        HostedZoneId: zone.zoneId,
        StartRecordName: startName,
        StartRecordType: startType,
        MaxItems: 300,
      }),
    );
    for (const r of res.ResourceRecordSets ?? []) {
      out.push({
        name: (r.Name ?? '').replace(/\.$/, ''),
        type: r.Type ?? '',
        ttl: r.TTL ?? null,
        values: (r.ResourceRecords ?? []).map((v) => v.Value ?? ''),
      });
    }
    if (!res.IsTruncated) break;
    startName = res.NextRecordName;
    startType = res.NextRecordType;
  }

  // Resolve ownership from the markers present in the same listing — no extra
  // queries, and it survives a DB that has lost track of a record.
  const claimed = new Set(
    out
      .filter((r) => r.type === 'TXT' && r.name.startsWith(MARKER_PREFIX))
      .map((r) => r.name.slice(MARKER_PREFIX.length)),
  );

  return out.map((r) => ({
    ...r,
    managed: claimed.has(r.name),
    marker: r.type === 'TXT' && r.name.startsWith(MARKER_PREFIX),
  }));
}

/**
 * Poll the zone's own authoritative nameservers, not a recursive resolver:
 * 8.8.8.8 caches negatives and will happily lie for the whole TTL.
 */
export async function waitForTxtPropagation(
  zone: ZoneConfig,
  name: string,
  expected: string,
  timeoutMs = 180_000,
  onTick?: (msg: string) => void,
): Promise<void> {
  const hz = await clientFor(zone).send(new GetHostedZoneCommand({ Id: zone.zoneId }));
  const nsNames = hz.DelegationSet?.NameServers ?? [];
  if (nsNames.length === 0) throw new ApiError('upstream_error', 'Hosted zone has no delegation set');

  const sysResolver = new Resolver();
  const nsIps = (
    await Promise.all(
      nsNames.map(async (ns) => {
        try {
          return await sysResolver.resolve4(ns);
        } catch {
          return [] as string[];
        }
      }),
    )
  ).flat();
  if (nsIps.length === 0) throw new ApiError('upstream_error', 'Could not resolve any authoritative nameserver');

  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const results = await Promise.all(
      nsIps.map(async (ip) => {
        const r = new Resolver();
        r.setServers([ip]);
        try {
          const records = await r.resolveTxt(name);
          return records.some((chunks) => chunks.join('') === expected);
        } catch {
          return false;
        }
      }),
    );
    if (results.every(Boolean)) return;
    onTick?.(`TXT seen on ${results.filter(Boolean).length}/${nsIps.length} authoritative NS (attempt ${attempt})`);
    await sleep(5000);
  }
  throw new ApiError('upstream_error', `TXT ${name} did not propagate to all authoritative nameservers`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

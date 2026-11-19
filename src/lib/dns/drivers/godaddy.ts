import { relativeName, request, type DnsDriver, type DriverConfig, type Rrset } from './types';

/**
 * GoDaddy Domains API v1 — https://developer.godaddy.com/doc/endpoint/domains.
 * The zone id is the domain name. TXT data is sent and returned unquoted.
 */

const BASE = 'https://api.godaddy.com/v1';

function call(cfg: DriverConfig, path: string, init: RequestInit & { okStatuses?: number[] } = {}) {
  return request('GoDaddy', `${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `sso-key ${cfg.api_key}:${cfg.api_secret}`,
      'content-type': 'application/json',
    },
  });
}

const enc = encodeURIComponent;
const label = (fqdn: string, zone: string) => relativeName(fqdn, zone) || '@';
const absolute = (name: string, zone: string) => (name === '@' ? zone : `${name}.${zone}`);

interface GoDaddyRecord {
  name: string;
  type: string;
  data: string;
  ttl: number;
}

function group(rows: GoDaddyRecord[], zone: string): Rrset[] {
  const sets = new Map<string, Rrset>();
  for (const r of rows) {
    const key = `${r.name}|${r.type}`;
    const set = sets.get(key) ?? { name: absolute(r.name, zone), type: r.type, ttl: r.ttl ?? null, values: [] };
    set.values.push(r.data);
    sets.set(key, set);
  }
  return [...sets.values()];
}

export const godaddy: DnsDriver = {
  minTtl: 600,

  async listZones(cfg) {
    const rows = (await call(cfg, '/domains?statuses=ACTIVE&limit=500')) as Array<{ domain: string }>;
    return rows.map((r) => ({ id: r.domain, name: r.domain }));
  },

  async zoneName(cfg, zoneId) {
    const row = (await call(cfg, `/domains/${enc(zoneId)}`)) as { domain: string };
    return row.domain;
  },

  async nameservers(cfg, zoneId) {
    const row = (await call(cfg, `/domains/${enc(zoneId)}`)) as { nameServers?: string[] };
    return row.nameServers ?? [];
  },

  async getRrset(cfg, zoneId, fqdn, type) {
    const rows = (await call(
      cfg,
      `/domains/${enc(zoneId)}/records/${type}/${enc(label(fqdn, zoneId))}`,
      { okStatuses: [404] },
    )) as GoDaddyRecord[] | null;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return group(
      rows.map((r) => ({ ...r, name: label(fqdn, zoneId), type })),
      zoneId,
    )[0];
  },

  async setRrset(cfg, zoneId, fqdn, type, values, ttl) {
    await call(cfg, `/domains/${enc(zoneId)}/records/${type}/${enc(label(fqdn, zoneId))}`, {
      method: 'PUT',
      body: JSON.stringify(values.map((data) => ({ data, ttl }))),
    });
  },

  async deleteRrset(cfg, zoneId, fqdn, type) {
    await call(cfg, `/domains/${enc(zoneId)}/records/${type}/${enc(label(fqdn, zoneId))}`, {
      method: 'DELETE',
      okStatuses: [404],
    });
  },

  async listRrsets(cfg, zoneId) {
    const rows = (await call(cfg, `/domains/${enc(zoneId)}/records`)) as GoDaddyRecord[];
    return group(rows, zoneId);
  },
};

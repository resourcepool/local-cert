import { DriverError, quoteTxt, relativeName, request, unquoteTxt, type DnsDriver, type DriverConfig, type Rrset } from './types';

/** Gandi LiveDNS v5 — https://api.gandi.net/docs/livedns/. The zone id is the domain name. */

const BASE = 'https://api.gandi.net/v5/livedns';

function call(cfg: DriverConfig, path: string, init: RequestInit & { okStatuses?: number[] } = {}) {
  return request('Gandi', `${BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' },
  });
}

const enc = encodeURIComponent;
const label = (fqdn: string, zone: string) => relativeName(fqdn, zone) || '@';
const absolute = (name: string, zone: string) => (name === '@' ? zone : `${name}.${zone}`);

interface GandiRecord {
  rrset_name: string;
  rrset_type: string;
  rrset_ttl: number;
  rrset_values: string[];
}

const toRrset = (r: GandiRecord, zone: string): Rrset => ({
  name: absolute(r.rrset_name, zone),
  type: r.rrset_type,
  ttl: r.rrset_ttl ?? null,
  values: r.rrset_type === 'TXT' ? r.rrset_values.map(unquoteTxt) : r.rrset_values,
});

export const gandi: DnsDriver = {
  minTtl: 300,

  async listZones(cfg) {
    const rows = (await call(cfg, '/domains?per_page=500')) as Array<{ fqdn: string }>;
    return rows.map((r) => ({ id: r.fqdn, name: r.fqdn }));
  },

  async zoneName(cfg, zoneId) {
    const row = (await call(cfg, `/domains/${enc(zoneId)}`)) as { fqdn: string };
    return row.fqdn;
  },

  async nameservers(cfg, zoneId) {
    return (await call(cfg, `/domains/${enc(zoneId)}/nameservers`)) as string[];
  },

  async getRrset(cfg, zoneId, fqdn, type) {
    try {
      const row = (await call(
        cfg,
        `/domains/${enc(zoneId)}/records/${enc(label(fqdn, zoneId))}/${type}`,
      )) as GandiRecord;
      return toRrset({ ...row, rrset_name: label(fqdn, zoneId), rrset_type: type }, zoneId);
    } catch (err) {
      if (err instanceof DriverError && err.status === 404) return null;
      throw err;
    }
  },

  async setRrset(cfg, zoneId, fqdn, type, values, ttl) {
    await call(cfg, `/domains/${enc(zoneId)}/records/${enc(label(fqdn, zoneId))}/${type}`, {
      method: 'PUT',
      body: JSON.stringify({
        rrset_ttl: ttl,
        rrset_values: type === 'TXT' ? values.map(quoteTxt) : values,
      }),
    });
  },

  async deleteRrset(cfg, zoneId, fqdn, type) {
    await call(cfg, `/domains/${enc(zoneId)}/records/${enc(label(fqdn, zoneId))}/${type}`, {
      method: 'DELETE',
      okStatuses: [404],
    });
  },

  async listRrsets(cfg, zoneId) {
    const rows = (await call(cfg, `/domains/${enc(zoneId)}/records?per_page=1000`)) as GandiRecord[];
    return rows.map((r) => toRrset(r, zoneId));
  },
};

import { SignJWT, importPKCS8 } from 'jose';
import { DriverError, quoteTxt, request, unquoteTxt, type DnsDriver, type DriverConfig, type Rrset } from './types';

/**
 * Google Cloud DNS v1 — https://cloud.google.com/dns/docs/reference/rest/v1.
 * Authenticates as a service account from its JSON key; the zone id is the
 * managed zone's resource name (not its DNS name).
 */

const SCOPE = 'https://www.googleapis.com/auth/ndev.clouddns.readwrite';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
  token_uri?: string;
}

function account(cfg: DriverConfig): ServiceAccount {
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(cfg.service_account_json) as ServiceAccount;
  } catch {
    throw new DriverError('The service account key is not valid JSON', 0);
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new DriverError('The service account key lacks client_email or private_key', 0);
  }
  return parsed;
}

function project(cfg: DriverConfig): string {
  const id = cfg.project_id?.trim() || account(cfg).project_id;
  if (!id) throw new DriverError('No project id: set it, or use a key that carries project_id', 0);
  return id;
}

const tokens = new Map<string, { token: string; expires: number }>();

async function accessToken(cfg: DriverConfig): Promise<string> {
  const sa = account(cfg);
  const cached = tokens.get(sa.client_email);
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const tokenUri = sa.token_uri ?? 'https://oauth2.googleapis.com/token';
  let assertion: string;
  try {
    const key = await importPKCS8(sa.private_key, 'RS256');
    assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(sa.client_email)
      .setAudience(tokenUri)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key);
  } catch (err) {
    throw new DriverError(`The service account private key is unusable: ${(err as Error).message}`, 0);
  }
  const res = (await request('Google OAuth', tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  })) as { access_token: string; expires_in: number };
  tokens.set(sa.client_email, {
    token: res.access_token,
    expires: Date.now() + res.expires_in * 1000,
  });
  return res.access_token;
}

async function call(cfg: DriverConfig, path: string, init: RequestInit = {}): Promise<unknown> {
  const url = `https://dns.googleapis.com/dns/v1/projects/${encodeURIComponent(project(cfg))}${path}`;
  return request('Google Cloud DNS', url, {
    ...init,
    headers: {
      authorization: `Bearer ${await accessToken(cfg)}`,
      'content-type': 'application/json',
    },
  });
}

const enc = encodeURIComponent;
const dotted = (name: string) => (name.endsWith('.') ? name : `${name}.`);

interface GcpRrset {
  name: string;
  type: string;
  ttl: number;
  rrdatas: string[];
}
interface GcpZone {
  name: string;
  dnsName: string;
  visibility?: string;
  nameServers?: string[];
}

const toRrset = (r: GcpRrset): Rrset => ({
  name: r.name.replace(/\.$/, ''),
  type: r.type,
  ttl: r.ttl ?? null,
  values: r.type === 'TXT' ? (r.rrdatas ?? []).map(unquoteTxt) : (r.rrdatas ?? []),
});

/** the record set exactly as the API holds it — a deletion must match it verbatim */
async function raw(cfg: DriverConfig, zoneId: string, fqdn: string, type: string): Promise<GcpRrset | null> {
  const res = (await call(
    cfg,
    `/managedZones/${enc(zoneId)}/rrsets?name=${enc(dotted(fqdn))}&type=${enc(type)}`,
  )) as { rrsets?: GcpRrset[] };
  return res.rrsets?.[0] ?? null;
}

const zone = (cfg: DriverConfig, zoneId: string) =>
  call(cfg, `/managedZones/${enc(zoneId)}`) as Promise<GcpZone>;

export const gcp: DnsDriver = {
  minTtl: 1,

  async listZones(cfg) {
    const out: Array<{ id: string; name: string; private: boolean }> = [];
    let page: string | undefined;
    do {
      const res = (await call(cfg, `/managedZones${page ? `?pageToken=${enc(page)}` : ''}`)) as {
        managedZones?: GcpZone[];
        nextPageToken?: string;
      };
      for (const z of res.managedZones ?? []) {
        out.push({
          id: z.name,
          name: z.dnsName.replace(/\.$/, ''),
          private: z.visibility === 'private',
        });
      }
      page = res.nextPageToken;
    } while (page);
    return out;
  },

  async zoneName(cfg, zoneId) {
    return (await zone(cfg, zoneId)).dnsName.replace(/\.$/, '');
  },

  async nameservers(cfg, zoneId) {
    return ((await zone(cfg, zoneId)).nameServers ?? []).map((ns) => ns.replace(/\.$/, ''));
  },

  async getRrset(cfg, zoneId, fqdn, type) {
    const found = await raw(cfg, zoneId, fqdn, type);
    return found ? toRrset(found) : null;
  },

  async setRrset(cfg, zoneId, fqdn, type, values, ttl) {
    const existing = await raw(cfg, zoneId, fqdn, type);
    await call(cfg, `/managedZones/${enc(zoneId)}/changes`, {
      method: 'POST',
      body: JSON.stringify({
        deletions: existing ? [existing] : [],
        additions: [
          {
            name: dotted(fqdn),
            type,
            ttl,
            rrdatas: type === 'TXT' ? values.map(quoteTxt) : values,
          },
        ],
      }),
    });
  },

  async deleteRrset(cfg, zoneId, fqdn, type) {
    const existing = await raw(cfg, zoneId, fqdn, type);
    if (!existing) return;
    await call(cfg, `/managedZones/${enc(zoneId)}/changes`, {
      method: 'POST',
      body: JSON.stringify({ deletions: [existing] }),
    });
  },

  async listRrsets(cfg, zoneId) {
    const out: Rrset[] = [];
    let page: string | undefined;
    do {
      const res = (await call(
        cfg,
        `/managedZones/${enc(zoneId)}/rrsets${page ? `?pageToken=${enc(page)}` : ''}`,
      )) as { rrsets?: GcpRrset[]; nextPageToken?: string };
      out.push(...(res.rrsets ?? []).map(toRrset));
      page = res.nextPageToken;
    } while (page);
    return out;
  },
};

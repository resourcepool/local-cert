/**
 * What local-cert needs from a DNS host other than Route53.
 *
 * Route53 keeps its own, older code path (lib/dns/route53.ts): it has batched
 * atomic changes and change tracking that the others lack. Everyone else fits
 * this small record-set interface, and lib/dns/zone.ts builds the shared
 * behaviour — provenance markers, ownership, propagation polling, preflight —
 * on top of it once, instead of once per host.
 *
 * Names are always fully qualified without trailing dot; values are always
 * unquoted. Each driver translates to whatever its API wants.
 */

/** provider settings and secrets, merged; keys are the field keys of provider-types.ts */
export type DriverConfig = Record<string, string>;

export interface DriverZone {
  /** what the API addresses the zone by */
  id: string;
  /** apex name, e.g. "example.com" */
  name: string;
  private?: boolean;
  /**
   * Whether the public delegation of the name points at this host: false means
   * the zone exists here but something else answers for it, so a record written
   * here is never seen by Let's Encrypt. Undefined/null: not checked or unknown.
   */
  delegated?: boolean | null;
  /** the nameservers the public DNS returns for the name, when looked up */
  publicNameservers?: string[];
}

export interface Rrset {
  name: string;
  type: string;
  ttl: number | null;
  values: string[];
}

export interface DnsDriver {
  /** smallest TTL the host accepts; smaller requests are raised to it */
  minTtl: number;
  /** `delegation`: also work out DriverZone.delegated, where the host supports it */
  listZones(cfg: DriverConfig, opts?: { delegation?: boolean }): Promise<DriverZone[]>;
  zoneName(cfg: DriverConfig, zoneId: string): Promise<string>;
  /** authoritative nameserver hostnames, polled directly during DNS-01 */
  nameservers(cfg: DriverConfig, zoneId: string): Promise<string[]>;
  getRrset(cfg: DriverConfig, zoneId: string, fqdn: string, type: string): Promise<Rrset | null>;
  /** replaces the whole record set */
  setRrset(
    cfg: DriverConfig,
    zoneId: string,
    fqdn: string,
    type: string,
    values: string[],
    ttl: number,
  ): Promise<void>;
  /** removing an absent record set is not an error */
  deleteRrset(cfg: DriverConfig, zoneId: string, fqdn: string, type: string): Promise<void>;
  listRrsets(cfg: DriverConfig, zoneId: string): Promise<Rrset[]>;
}

export class DriverError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'DriverError';
  }
  get denied(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/** JSON over HTTPS with a timeout and errors that say which host and why. */
export async function request(
  host: string,
  url: string,
  init: RequestInit & { okStatuses?: number[] } = {},
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new DriverError(`${host}: ${(err as Error).message}`, 0);
  }
  const text = await res.text();
  if (!res.ok && !(init.okStatuses ?? []).includes(res.status)) {
    let detail = text.slice(0, 240);
    try {
      const body = JSON.parse(text) as Record<string, unknown>;
      // Each host has its own error envelope; take the first field that says something.
      const error = body.error;
      const candidates = [
        body.message,
        typeof error === 'object' && error !== null ? (error as { message?: unknown }).message : null,
        typeof error === 'string' && body.error_description
          ? `${error} — ${String(body.error_description)}`
          : error,
        body.cause,
        body.code,
      ];
      const found = candidates.find((c) => typeof c === 'string' && c.trim() !== '');
      if (typeof found === 'string') detail = found;
    } catch {
      // not JSON: keep the raw excerpt
    }
    throw new DriverError(`${host} ${res.status}: ${detail}`, res.status);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** "nas.home.example.com" in zone "example.com" -> "nas.home"; the apex -> "" */
export function relativeName(fqdn: string, zone: string): string {
  const name = fqdn.replace(/\.$/, '').toLowerCase();
  const apex = zone.replace(/\.$/, '').toLowerCase();
  if (name === apex) return '';
  if (!name.endsWith(`.${apex}`)) {
    throw new DriverError(`"${fqdn}" is not inside zone "${zone}"`, 0);
  }
  return name.slice(0, -(apex.length + 1));
}

export const quoteTxt = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Undoes quoteTxt, and joins the 255-byte chunks a long TXT comes back in. */
export function unquoteTxt(v: string): string {
  const parts = v.match(/"((?:[^"\\]|\\.)*)"/g);
  if (!parts) return v;
  return parts.map((p) => p.slice(1, -1).replace(/\\(.)/g, '$1')).join('');
}

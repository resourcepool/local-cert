/** Scope catalogue. Grants are (api_key, domain) -> scopes[]; admin bypasses all. */
export const SCOPES = {
  CERT_READ: 'cert:read',
  CERT_ISSUE: 'cert:issue',
  CERT_RENEW: 'cert:renew',
  CERT_REVOKE: 'cert:revoke',
  /** allows downloading the private key material, not just metadata */
  CERT_EXPORT: 'cert:export',
  DNS_READ: 'dns:read',
  DNS_WRITE: 'dns:write',
  ADMIN: 'admin:*',
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

export const ALL_SCOPES: Scope[] = Object.values(SCOPES);

export const DOMAIN_SCOPES: Scope[] = [
  SCOPES.CERT_READ,
  SCOPES.CERT_ISSUE,
  SCOPES.CERT_RENEW,
  SCOPES.CERT_REVOKE,
  SCOPES.CERT_EXPORT,
  SCOPES.DNS_READ,
  SCOPES.DNS_WRITE,
];

export const SCOPE_LABELS: Record<string, string> = {
  'cert:read': 'Read certificates',
  'cert:issue': 'Issue a certificate',
  'cert:renew': 'Renew',
  'cert:revoke': 'Revoke / delete',
  'cert:export': 'Export the private key',
  'dns:read': 'Read DNS records',
  'dns:write': 'Write DNS records',
  'admin:*': 'Administrator (everything)',
};

export function parseScopes(json: string): Scope[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((s): s is Scope => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function hasScope(held: readonly string[], needed: Scope): boolean {
  return held.includes(SCOPES.ADMIN) || held.includes(needed);
}

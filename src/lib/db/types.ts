/**
 * Kysely schema shared by both dialects.
 *
 * Portability rules (SQLite <-> Postgres):
 *  - timestamps  : TEXT holding an ISO-8601 UTC string
 *  - booleans    : INTEGER 0/1
 *  - json blobs  : TEXT holding JSON
 * The migration layer emits the dialect-specific DDL; the query layer is shared.
 */

export interface Database {
  settings: SettingsTable;
  users: UsersTable;
  api_keys: ApiKeysTable;
  domains: DomainsTable;
  grants: GrantsTable;
  certificates: CertificatesTable;
  certificate_events: CertificateEventsTable;
  audit_log: AuditLogTable;
  acme_eab_keys: AcmeEabKeysTable;
  acme_accounts: AcmeAccountsTable;
  acme_orders: AcmeOrdersTable;
  acme_authorizations: AcmeAuthorizationsTable;
  acme_nonces: AcmeNoncesTable;
}

/** External Account Binding credential: lets an ACME client act as an API key. */
export interface AcmeEabKeysTable {
  /** the EAB `kid` */
  id: string;
  api_key_id: string;
  /** AES-256-GCM envelope of the base64url HMAC key */
  hmac_enc: string;
  created_by: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface AcmeAccountsTable {
  id: string;
  /** the API key whose grants decide what this account may order */
  api_key_id: string;
  eab_id: string;
  /** JSON public JWK of the account key */
  jwk: string;
  /** RFC 7638 thumbprint, unique: one account per key */
  thumbprint: string;
  /** JSON array of contact URIs */
  contact: string;
  status: 'valid' | 'deactivated';
  created_at: string;
}

export interface AcmeOrdersTable {
  id: string;
  account_id: string;
  certificate_id: string;
  /** JSON array of DNS names as requested (wildcards keep their "*.") */
  identifiers: string;
  /** 'pending' also covers RFC 8555 "ready", which is derived from the authorizations */
  status: 'pending' | 'processing' | 'valid' | 'invalid';
  /** DNS-01 validation against the upstream CA; starts when the client answers a challenge */
  upstream_status: 'idle' | 'running' | 'ready' | 'failed';
  upstream_order_url: string | null;
  /** JSON problem document */
  error: string | null;
  expires_at: string;
  created_at: string;
}

export interface AcmeAuthorizationsTable {
  id: string;
  order_id: string;
  /** DNS name without the wildcard label */
  identifier: string;
  wildcard: number;
  token: string;
  /** challenge type the client answered, null until it does */
  responded_type: string | null;
  created_at: string;
}

export interface AcmeNoncesTable {
  nonce: string;
  expires_at: string;
}

export interface SettingsTable {
  key: string;
  value: string;
  updated_at: string;
}

export interface UsersTable {
  id: string;
  email: string;
  /** argon2id PHC string */
  password_hash: string;
  is_admin: number;
  created_at: string;
  last_login_at: string | null;
  disabled_at: string | null;
}

export interface ApiKeysTable {
  id: string;
  name: string;
  /** owning user, when the key was minted alongside an account */
  user_id: string | null;
  /** sha256 of the secret half (minted keys) or of the whole token (opaque keys) */
  secret_hash: string;
  /** 8-char lookup prefix, safe to display */
  prefix: string;
  /** 1 when the token was supplied verbatim (ADMIN_API_KEY) rather than minted */
  opaque: number;
  is_admin: number;
  /** JSON array of global scopes, e.g. ["admin:*"] or ["cert:read"] */
  global_scopes: string;
  created_at: string;
  /** ISO date or null = never expires */
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface DomainsTable {
  id: string;
  /** apex or delegated base name, e.g. "home.example.com" */
  name: string;
  route53_zone_id: string;
  /** optional AWS role to assume for this zone */
  aws_role_arn: string | null;
  aws_region: string;
  /** default TTL for records created under this domain */
  default_ttl: number;
  created_at: string;
}

export interface GrantsTable {
  id: string;
  api_key_id: string;
  domain_id: string;
  /** JSON array of scopes granted on this domain */
  scopes: string;
  created_at: string;
}

export type CertificateStatus =
  | 'pending'
  | 'dns_propagating'
  | 'validating'
  | 'issued'
  | 'failed'
  | 'revoked'
  | 'expired';

export interface CertificatesTable {
  id: string;
  domain_id: string;
  /** JSON array of SANs; domains[0] is the CN */
  domains: string;
  status: CertificateStatus;
  key_type: string;
  /** AES-256-GCM envelope, base64 */
  private_key_enc: string | null;
  cert_pem: string | null;
  chain_pem: string | null;
  serial: string | null;
  issuer: string | null;
  not_before: string | null;
  not_after: string | null;
  fingerprint_sha256: string | null;
  auto_renew: number;
  renew_before_days: number;
  /** JSON: { create_record, target_ip, ttl } */
  dns_record: string | null;
  webhook_url: string | null;
  /** JSON object of caller-supplied string key/values, for business context */
  metadata: string;
  /** 'api' = key generated here, worker-driven; 'acme' = CSR from an ACME client */
  source: 'api' | 'acme';
  last_error: string | null;
  /** set while a worker holds the order, for crash recovery */
  locked_at: string | null;
  attempt: number;
  next_attempt_at: string | null;
  idempotency_key: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CertificateEventsTable {
  id: string;
  certificate_id: string;
  at: string;
  level: 'info' | 'warn' | 'error';
  step: string;
  message: string;
}

export interface AuditLogTable {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
}

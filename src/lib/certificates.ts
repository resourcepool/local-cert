import 'server-only';
import { db, nowIso } from '@/lib/db';
import { randomId } from '@/lib/crypto/secrets';
import { ApiError } from '@/lib/http';
import { belongsToDomain } from '@/lib/validation';
import type { CertificatesTable, DomainsTable } from '@/lib/db/types';
import type { CertificateResource } from '@/lib/api/schemas';

export type CertRow = CertificatesTable;
export type DomainRow = DomainsTable;

export async function listDomains(): Promise<DomainRow[]> {
  return db().selectFrom('domains').selectAll().orderBy('name', 'asc').execute();
}

/** Longest-suffix match, so a delegated `home.example.com` wins over `example.com`. */
export async function domainForFqdn(fqdn: string): Promise<DomainRow> {
  const domains = await listDomains();
  const matches = domains
    .filter((d) => belongsToDomain(fqdn, d.name))
    .sort((a, b) => b.name.length - a.name.length);
  if (matches.length === 0) {
    throw new ApiError('validation_error', `No managed domain covers "${fqdn}"`);
  }
  return matches[0];
}

export function parseMetadata(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * The return type is the published OpenAPI schema: changing the shape here
 * without updating api/schemas.ts fails the type check.
 */
export function serializeCert(row: CertRow, domainName: string): CertificateResource {
  const daysRemaining = row.not_after
    ? Math.floor((new Date(row.not_after).getTime() - Date.now()) / 86_400_000)
    : null;
  return {
    id: row.id,
    status: row.status,
    domains: JSON.parse(row.domains) as string[],
    managed_domain: domainName,
    key_type: row.key_type,
    serial: row.serial,
    issuer: row.issuer,
    not_before: row.not_before,
    not_after: row.not_after,
    days_remaining: daysRemaining,
    fingerprint_sha256: row.fingerprint_sha256,
    auto_renew: row.auto_renew === 1,
    renew_before_days: row.renew_before_days,
    dns_record: row.dns_record ? JSON.parse(row.dns_record) : null,
    metadata: parseMetadata(row.metadata),
    webhook_url: row.webhook_url,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
    links: {
      self: `/api/v1/certificates/${row.id}`,
      bundle: `/api/v1/certificates/${row.id}/bundle`,
      events: `/api/v1/certificates/${row.id}/events`,
    },
  };
}

export async function findByIdempotencyKey(key: string, keyId: string): Promise<CertRow | undefined> {
  return db()
    .selectFrom('certificates')
    .selectAll()
    .where('idempotency_key', '=', `${keyId}:${key}`)
    .executeTakeFirst();
}

export interface CreateCertInput {
  domains: string[];
  domainId: string;
  keyType: string;
  autoRenew: boolean;
  renewBeforeDays: number;
  webhookUrl: string | null;
  dnsRecord: unknown | null;
  metadata: Record<string, string>;
  createdBy: string;
  idempotencyKey: string | null;
  /** 'acme' rows are driven by the ACME server; the worker leaves them alone */
  source?: 'api' | 'acme';
}

export async function createCertificate(input: CreateCertInput): Promise<CertRow> {
  const id = randomId('cert');
  const now = nowIso();
  const row: CertRow = {
    id,
    domain_id: input.domainId,
    domains: JSON.stringify(input.domains),
    status: 'pending',
    key_type: input.keyType,
    private_key_enc: null,
    cert_pem: null,
    chain_pem: null,
    serial: null,
    issuer: null,
    not_before: null,
    not_after: null,
    fingerprint_sha256: null,
    auto_renew: input.autoRenew ? 1 : 0,
    renew_before_days: input.renewBeforeDays,
    dns_record: input.dnsRecord ? JSON.stringify(input.dnsRecord) : null,
    metadata: JSON.stringify(input.metadata ?? {}),
    source: input.source ?? 'api',
    webhook_url: input.webhookUrl,
    last_error: null,
    locked_at: null,
    attempt: 0,
    next_attempt_at: null,
    idempotency_key: input.idempotencyKey,
    created_by: input.createdBy,
    created_at: now,
    updated_at: now,
  };
  await db().insertInto('certificates').values(row).execute();
  return row;
}

import 'server-only';
import { randomBytes } from 'node:crypto';
import { db, nowIso } from '@/lib/db';
import type { AcmeEabKeysTable } from '@/lib/db/types';
import { randomId, encryptSecret } from '@/lib/crypto/secrets';
import { ApiError } from '@/lib/http';
import type { AcmeEabCreated, AcmeEabResource } from '@/lib/api/schemas';

/**
 * External Account Binding credentials: the ACME-side counterpart of an API
 * key. Each one has a name, an optional expiry and the list of managed
 * domains its ACME accounts may order certificates under.
 */

export function eabDomainIds(row: Pick<AcmeEabKeysTable, 'domain_ids'>): string[] {
  try {
    const parsed = JSON.parse(row.domain_ids);
    return Array.isArray(parsed) ? parsed.filter((d) => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

/** False once revoked or expired — checked on every ACME request, not just at registration. */
export function eabUsable(row: Pick<AcmeEabKeysTable, 'revoked_at' | 'expires_at'>): boolean {
  if (row.revoked_at) return false;
  return !(row.expires_at && new Date(row.expires_at) < new Date());
}

export async function listEabKeys(id?: string): Promise<AcmeEabResource[]> {
  let q = db().selectFrom('acme_eab_keys').selectAll().orderBy('created_at', 'desc');
  if (id) q = q.where('id', '=', id);
  const [rows, domains, accounts] = await Promise.all([
    q.execute(),
    db().selectFrom('domains').select(['id', 'name']).execute(),
    db().selectFrom('acme_accounts').select(['eab_id']).where('status', '=', 'valid').execute(),
  ]);

  const names = new Map(domains.map((d) => [d.id, d.name]));
  const count = new Map<string, number>();
  for (const a of accounts) count.set(a.eab_id, (count.get(a.eab_id) ?? 0) + 1);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    // a deleted domain simply drops out of the list
    domains: eabDomainIds(r)
      .filter((d) => names.has(d))
      .map((d) => ({ id: d, name: names.get(d)! })),
    created_at: r.created_at,
    expires_at: r.expires_at,
    last_used_at: r.last_used_at,
    revoked_at: r.revoked_at,
    accounts: count.get(r.id) ?? 0,
  }));
}

export async function createEabKey(
  input: { name: string; expires_at?: string | null; domain_ids: string[] },
  createdBy: string,
  directoryUrl: string,
): Promise<AcmeEabCreated> {
  const domainIds = [...new Set(input.domain_ids)];
  const known = await db().selectFrom('domains').select('id').where('id', 'in', domainIds).execute();
  if (known.length !== domainIds.length) {
    throw new ApiError('validation_error', 'domain_ids references a domain that does not exist');
  }

  const id = randomId('eab');
  const hmacKey = randomBytes(32).toString('base64url');
  await db()
    .insertInto('acme_eab_keys')
    .values({
      id,
      name: input.name,
      hmac_enc: encryptSecret(hmacKey),
      domain_ids: JSON.stringify(domainIds),
      created_by: createdBy,
      created_at: nowIso(),
      expires_at: input.expires_at ?? null,
      last_used_at: null,
      revoked_at: null,
    })
    .execute();

  const [resource] = await listEabKeys(id);
  return { ...resource, hmac_key: hmacKey, directory_url: directoryUrl };
}

/** Revokes the credential and deactivates every ACME account registered with it. */
export async function revokeEabKey(id: string): Promise<AcmeEabResource> {
  const row = await db().selectFrom('acme_eab_keys').select(['id', 'revoked_at']).where('id', '=', id).executeTakeFirst();
  if (!row) throw new ApiError('not_found', 'EAB credential not found');

  if (!row.revoked_at) {
    await db().updateTable('acme_eab_keys').set({ revoked_at: nowIso() }).where('id', '=', id).execute();
  }
  await db().updateTable('acme_accounts').set({ status: 'deactivated' }).where('eab_id', '=', id).execute();

  const [resource] = await listEabKeys(id);
  return resource;
}

/** Removes the credential, its ACME accounts and their orders. Issued certificates stay. */
export async function deleteEabKey(id: string): Promise<void> {
  const res = await db().deleteFrom('acme_eab_keys').where('id', '=', id).executeTakeFirst();
  if (Number(res.numDeletedRows ?? 0) === 0) throw new ApiError('not_found', 'EAB credential not found');
}

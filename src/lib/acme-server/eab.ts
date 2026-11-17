import 'server-only';
import { randomBytes } from 'node:crypto';
import { db, nowIso } from '@/lib/db';
import { randomId, encryptSecret } from '@/lib/crypto/secrets';
import { resolveApiKeyById } from '@/lib/auth/apikey';
import { requireAdmin, type Principal } from '@/lib/auth/guard';
import { ApiError } from '@/lib/http';
import type { AcmeEabCreated, AcmeEabResource } from '@/lib/api/schemas';

/**
 * External Account Binding credentials. One of these is what turns an
 * anonymous ACME client into "API key X": the account it registers inherits
 * that key's grants, and dies with it.
 */

async function serialize(where?: { apiKeyId?: string; id?: string }): Promise<AcmeEabResource[]> {
  let q = db().selectFrom('acme_eab_keys').selectAll().orderBy('created_at', 'desc');
  if (where?.apiKeyId) q = q.where('api_key_id', '=', where.apiKeyId);
  if (where?.id) q = q.where('id', '=', where.id);
  const rows = await q.execute();

  const accounts = await db()
    .selectFrom('acme_accounts')
    .select(['eab_id'])
    .where('status', '=', 'valid')
    .execute();
  const count = new Map<string, number>();
  for (const a of accounts) count.set(a.eab_id, (count.get(a.eab_id) ?? 0) + 1);

  return rows.map((r) => ({
    id: r.id,
    api_key_id: r.api_key_id,
    created_at: r.created_at,
    last_used_at: r.last_used_at,
    revoked_at: r.revoked_at,
    accounts: count.get(r.id) ?? 0,
  }));
}

/** Admins see every credential; a key only sees its own. */
export async function listEabKeys(principal: Principal): Promise<AcmeEabResource[]> {
  const admin = principal.isAdmin;
  if (!admin && principal.kind !== 'key') return [];
  return serialize(admin ? undefined : { apiKeyId: principal.keyId });
}

export async function createEabKey(
  principal: Principal,
  apiKeyId: string | undefined,
  directoryUrl: string,
): Promise<AcmeEabCreated> {
  const target = apiKeyId ?? (principal.kind === 'key' ? principal.keyId : undefined);
  if (!target) {
    throw new ApiError('validation_error', 'api_key_id is required when not authenticating with an API key');
  }
  // Binding to somebody else's key hands out that key's grants: admin only.
  if (target !== principal.keyId || principal.kind !== 'key') requireAdmin(principal);
  if (!(await resolveApiKeyById(target))) {
    throw new ApiError('not_found', 'API key not found, revoked or expired');
  }

  const id = randomId('eab');
  const hmacKey = randomBytes(32).toString('base64url');
  await db()
    .insertInto('acme_eab_keys')
    .values({
      id,
      api_key_id: target,
      hmac_enc: encryptSecret(hmacKey),
      created_by: principal.keyId,
      created_at: nowIso(),
      last_used_at: null,
      revoked_at: null,
    })
    .execute();

  const [resource] = await serialize({ id });
  return { ...resource, hmac_key: hmacKey, directory_url: directoryUrl };
}

/** Revokes the credential and deactivates every ACME account registered with it. */
export async function revokeEabKey(principal: Principal, id: string): Promise<AcmeEabResource> {
  const row = await db().selectFrom('acme_eab_keys').selectAll().where('id', '=', id).executeTakeFirst();
  const own = principal.kind === 'key' && row?.api_key_id === principal.keyId;
  if (!row || (!own && !principal.isAdmin)) throw new ApiError('not_found', 'EAB credential not found');

  if (!row.revoked_at) {
    await db().updateTable('acme_eab_keys').set({ revoked_at: nowIso() }).where('id', '=', id).execute();
  }
  await db()
    .updateTable('acme_accounts')
    .set({ status: 'deactivated' })
    .where('eab_id', '=', id)
    .execute();

  const [resource] = await serialize({ id });
  return resource;
}

import { db, nowIso } from '@/lib/db';
import { ApiError } from '@/lib/http';
import { audit, type Principal } from '@/lib/auth/guard';
import { mintKey } from '@/lib/auth/apikey';
import { randomId } from '@/lib/crypto/secrets';
import { createApiKeySchema, updateGrantsSchema } from '@/lib/validation';
import { SCOPES, parseScopes } from '@/lib/scopes';

/**
 * API key administration, shared by the console routes (/api/admin/keys) and
 * the MCP admin tools. Callers authenticate and check admin rights; nothing in
 * here does.
 */

export async function listApiKeys() {
  const keys = await db().selectFrom('api_keys').selectAll().orderBy('created_at', 'desc').execute();
  const grants = await db().selectFrom('grants').selectAll().execute();
  const domains = await db().selectFrom('domains').select(['id', 'name']).execute();
  const domainName = new Map(domains.map((d) => [d.id, d.name]));

  return {
    items: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      user_id: k.user_id,
      opaque: k.opaque === 1,
      is_admin: k.is_admin === 1,
      global_scopes: parseScopes(k.global_scopes),
      created_at: k.created_at,
      expires_at: k.expires_at,
      last_used_at: k.last_used_at,
      revoked_at: k.revoked_at,
      grants: grants
        .filter((g) => g.api_key_id === k.id)
        .map((g) => ({
          domain_id: g.domain_id,
          domain: domainName.get(g.domain_id) ?? '(deleted)',
          scopes: parseScopes(g.scopes),
        })),
    })),
  };
}

/** Mints a key; the plaintext token is returned exactly once. */
export async function createApiKey(actor: Principal, body: unknown, req?: Request) {
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) throw new ApiError('validation_error', 'Invalid key', parsed.error.issues);
  const input = parsed.data;

  const minted = mintKey();
  await db()
    .insertInto('api_keys')
    .values({
      id: minted.id,
      name: input.name,
      user_id: null,
      secret_hash: minted.secretHash,
      prefix: minted.prefix,
      opaque: 0,
      is_admin: input.is_admin ? 1 : 0,
      global_scopes: JSON.stringify(input.is_admin ? [SCOPES.ADMIN] : []),
      created_at: nowIso(),
      expires_at: input.expires_at ?? null,
      last_used_at: null,
      revoked_at: null,
    })
    .execute();

  for (const grant of input.grants) {
    await db()
      .insertInto('grants')
      .values({
        id: randomId('grn'),
        api_key_id: minted.id,
        domain_id: grant.domain_id,
        scopes: JSON.stringify(grant.scopes),
        created_at: nowIso(),
      })
      .execute();
  }

  await audit(actor.keyId, 'apikey.create', {
    target: minted.id,
    detail: { name: input.name, is_admin: input.is_admin, grants: input.grants },
    req,
  });

  return {
    id: minted.id,
    name: input.name,
    prefix: minted.prefix,
    is_admin: input.is_admin,
    // shown once — never retrievable again
    token: minted.token,
  };
}

export interface ApiKeyPatch {
  name?: string;
  revoked?: boolean;
  /** replaces the whole grant set; validated here */
  grants?: unknown;
}

/** Replace the grant set, and/or revoke/restore the key, and/or rename it. */
export async function updateApiKey(
  actor: Principal,
  id: string,
  patch: ApiKeyPatch,
  req?: Request,
) {
  const key = await db().selectFrom('api_keys').selectAll().where('id', '=', id).executeTakeFirst();
  if (!key) throw new ApiError('not_found', 'API key not found');

  // Validate before the first write, so a bad grant set changes nothing.
  let grants: ReturnType<typeof updateGrantsSchema.parse>['grants'] | undefined;
  if (patch.grants !== undefined) {
    const parsed = updateGrantsSchema.safeParse({ grants: patch.grants });
    if (!parsed.success) {
      throw new ApiError('validation_error', 'Invalid grants', parsed.error.issues);
    }
    grants = parsed.data.grants;
  }

  if (typeof patch.revoked === 'boolean') {
    await db()
      .updateTable('api_keys')
      .set({ revoked_at: patch.revoked ? nowIso() : null })
      .where('id', '=', id)
      .execute();
  }

  if (grants) {
    await db().deleteFrom('grants').where('api_key_id', '=', id).execute();
    for (const grant of grants) {
      if (grant.scopes.length === 0) continue;
      await db()
        .insertInto('grants')
        .values({
          id: randomId('grn'),
          api_key_id: id,
          domain_id: grant.domain_id,
          scopes: JSON.stringify(grant.scopes),
          created_at: nowIso(),
        })
        .execute();
    }
  }

  const name = typeof patch.name === 'string' ? patch.name.trim() : '';
  if (name) {
    await db().updateTable('api_keys').set({ name }).where('id', '=', id).execute();
  }

  await audit(actor.keyId, 'apikey.update', {
    target: id,
    detail: {
      ...(typeof patch.revoked === 'boolean' ? { revoked: patch.revoked } : {}),
      ...(grants ? { grants } : {}),
      ...(name ? { name } : {}),
    },
    req,
  });
  return { id, updated: true };
}

export async function deleteApiKey(actor: Principal, id: string, req?: Request) {
  const key = await db()
    .selectFrom('api_keys')
    .select(['name', 'user_id'])
    .where('id', '=', id)
    .executeTakeFirst();
  if (!key) throw new ApiError('not_found', 'API key not found');

  // Console access is password-based, so this is not a lockout — but silently
  // dropping your own account's key is still a footgun. Revoking it is allowed.
  if (key.user_id && key.user_id === actor.keyId) {
    throw new ApiError(
      'conflict',
      "Cannot delete your own account's API key; revoke it or run scripts/reset-admin.ts to rotate it",
    );
  }
  // Same footgun when the caller is a key rather than a console session.
  if (actor.kind === 'key' && id === actor.keyId) {
    throw new ApiError(
      'conflict',
      'Cannot delete the API key this request is authenticated with; revoke it instead',
    );
  }

  await db().deleteFrom('api_keys').where('id', '=', id).execute();
  await audit(actor.keyId, 'apikey.delete', { target: id, req });
  return { id, deleted: true };
}

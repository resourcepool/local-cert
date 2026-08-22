import { db, nowIso } from '@/lib/db';
import { handler, ok, problem } from '@/lib/http';
import { requireAdminSession, audit } from '@/lib/auth/guard';
import { mintKey } from '@/lib/auth/apikey';
import { randomId } from '@/lib/crypto/secrets';
import { createApiKeySchema } from '@/lib/validation';
import { SCOPES, parseScopes } from '@/lib/scopes';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireAdminSession();
  const keys = await db().selectFrom('api_keys').selectAll().orderBy('created_at', 'desc').execute();
  const grants = await db().selectFrom('grants').selectAll().execute();
  const domains = await db().selectFrom('domains').select(['id', 'name']).execute();
  const domainName = new Map(domains.map((d) => [d.id, d.name]));

  return ok({
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
  });
});

/** POST — mints a key; the plaintext token is returned exactly once. */
export const POST = handler(async (req: Request) => {
  const session = await requireAdminSession();
  const parsed = createApiKeySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return problem('validation_error', 'Invalid key', parsed.error.issues);
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

  await audit(session.keyId, 'apikey.create', {
    target: minted.id,
    detail: { name: input.name, is_admin: input.is_admin, grants: input.grants },
    req,
  });

  return ok(
    {
      id: minted.id,
      name: input.name,
      prefix: minted.prefix,
      is_admin: input.is_admin,
      // shown once — never retrievable again
      token: minted.token,
    },
    { status: 201, headers: { 'cache-control': 'no-store' } },
  );
});

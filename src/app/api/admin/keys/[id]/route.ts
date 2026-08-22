import { db, nowIso } from '@/lib/db';
import { handler, ok, problem, ApiError } from '@/lib/http';
import { requireAdminSession, audit } from '@/lib/auth/guard';
import { randomId } from '@/lib/crypto/secrets';
import { updateGrantsSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — replace the grant set, and/or revoke/restore the key. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const session = await requireAdminSession();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const key = await db().selectFrom('api_keys').selectAll().where('id', '=', id).executeTakeFirst();
  if (!key) throw new ApiError('not_found', 'API key not found');

  if (typeof body.revoked === 'boolean') {
    await db()
      .updateTable('api_keys')
      .set({ revoked_at: body.revoked ? nowIso() : null })
      .where('id', '=', id)
      .execute();
  }

  if (body.grants !== undefined) {
    const parsed = updateGrantsSchema.safeParse({ grants: body.grants });
    if (!parsed.success) return problem('validation_error', 'Invalid grants', parsed.error.issues);

    await db().deleteFrom('grants').where('api_key_id', '=', id).execute();
    for (const grant of parsed.data.grants) {
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

  if (typeof body.name === 'string' && body.name.trim()) {
    await db().updateTable('api_keys').set({ name: body.name.trim() }).where('id', '=', id).execute();
  }

  await audit(session.keyId, 'apikey.update', { target: id, detail: body, req });
  return ok({ id, updated: true });
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const session = await requireAdminSession();
  const { id } = await ctx.params;

  const key = await db()
    .selectFrom('api_keys')
    .select(['name', 'user_id'])
    .where('id', '=', id)
    .executeTakeFirst();
  if (!key) throw new ApiError('not_found', 'API key not found');

  // Console access is password-based, so this is not a lockout — but silently
  // dropping your own account's key is still a footgun. Revoking it is allowed.
  if (key.user_id && key.user_id === session.keyId) {
    throw new ApiError(
      'conflict',
      "Cannot delete your own account's API key; revoke it or run scripts/reset-admin.ts to rotate it",
    );
  }

  await db().deleteFrom('api_keys').where('id', '=', id).execute();
  await audit(session.keyId, 'apikey.delete', { target: id, req });
  return ok({ id, deleted: true });
});

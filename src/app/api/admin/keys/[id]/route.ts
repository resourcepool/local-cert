import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { deleteApiKey, updateApiKey } from '@/lib/admin/keys';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — replace the grant set, and/or revoke/restore the key. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const session = await requireAdminSession();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) ?? {};
  return ok(
    await updateApiKey(
      session,
      id,
      {
        revoked: typeof body.revoked === 'boolean' ? body.revoked : undefined,
        grants: body.grants,
        name: typeof body.name === 'string' ? body.name : undefined,
      },
      req,
    ),
  );
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const session = await requireAdminSession();
  const { id } = await ctx.params;
  return ok(await deleteApiKey(session, id, req));
});

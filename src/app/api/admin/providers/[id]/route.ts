import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { deleteProvider, updateProvider } from '@/lib/dns/providers';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/providers/{id}?force=true — rename, rotate the key pair, change the role, finalise a draft. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const session = await requireAdminSession();
  const { id } = await ctx.params;
  const force = new URL(req.url).searchParams.get('force') === 'true';
  return ok(await updateProvider(session, id, await req.json().catch(() => null), { force, req }));
});

/**
 * DELETE /api/admin/providers/{id}?cleanup=true — remove the provider; with
 * cleanup, first delete its IAM user and empty its role on AWS.
 */
export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const session = await requireAdminSession();
  const { id } = await ctx.params;
  const cleanup = new URL(req.url).searchParams.get('cleanup') === 'true';
  return ok(await deleteProvider(session, id, { cleanup, req }));
});

import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { deleteDomain } from '@/lib/admin/domains';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/admin/domains/{id}[?force=true] — see deleteDomain for the cascade. */
export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const session = await requireAdminSession();
  const { id } = await ctx.params;
  const force = new URL(req.url).searchParams.get('force') === 'true';
  return ok(await deleteDomain(session, id, { force, req }));
});

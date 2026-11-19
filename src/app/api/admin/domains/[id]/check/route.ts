import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { recheckDomain } from '@/lib/admin/domains';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/admin/domains/{id}/check — test the zone now; on failure, restart the automatic checks. */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const session = await requireAdminSession();
  const { id } = await ctx.params;
  return ok(await recheckDomain(session, id, { req }));
});

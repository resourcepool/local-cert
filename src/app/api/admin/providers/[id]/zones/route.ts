import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { listProviderZones } from '@/lib/dns/providers';

export const dynamic = 'force-dynamic';

/** GET /api/admin/providers/{id}/zones — hosted zones the provider can see. */
export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdminSession();
  const { id } = await ctx.params;
  return ok(await listProviderZones(id));
});

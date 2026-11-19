import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { providerPolicy } from '@/lib/dns/providers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/providers/{id}/policy?zone_id=Z1&zone_id=Z2
 *
 * The complete IAM permissions policy for the provider: the zones it already
 * serves plus the ones passed in.
 */
export const GET = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdminSession();
  const { id } = await ctx.params;
  const extra = new URL(req.url).searchParams
    .getAll('zone_id')
    .map((z) => z.trim().replace(/^\/hostedzone\//, ''))
    .filter(Boolean);
  return ok(await providerPolicy(id, extra));
});

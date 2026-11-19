import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { preflightDomain } from '@/lib/admin/domains';

export const dynamic = 'force-dynamic';

/** POST /api/admin/domains/preflight — the checks of a registration, nothing stored. */
export const POST = handler(async (req: Request) => {
  await requireAdminSession();
  return ok(await preflightDomain(await req.json().catch(() => null)));
});

import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { probeProvider } from '@/lib/dns/providers';

export const dynamic = 'force-dynamic';

/** POST /api/admin/providers/probe — tests credentials without storing them. */
export const POST = handler(async (req: Request) => {
  await requireAdminSession();
  return ok(await probeProvider(await req.json().catch(() => null)));
});

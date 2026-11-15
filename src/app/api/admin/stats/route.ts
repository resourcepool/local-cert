import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { getStats } from '@/lib/admin/stats';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireAdminSession();
  return ok(await getStats());
});

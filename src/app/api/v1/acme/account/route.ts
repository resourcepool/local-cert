import { handler, ok } from '@/lib/http';
import { requireAuth } from '@/lib/auth/guard';
import { accountStatus } from '@/lib/acme/client';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request) => {
  await requireAuth(req);
  return ok(await accountStatus());
});

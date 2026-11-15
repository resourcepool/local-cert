import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { createApiKey, listApiKeys } from '@/lib/admin/keys';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireAdminSession();
  return ok(await listApiKeys());
});

/** POST — mints a key; the plaintext token is returned exactly once. */
export const POST = handler(async (req: Request) => {
  const session = await requireAdminSession();
  const body = await req.json().catch(() => null);
  return ok(await createApiKey(session, body, req), {
    status: 201,
    headers: { 'cache-control': 'no-store' },
  });
});

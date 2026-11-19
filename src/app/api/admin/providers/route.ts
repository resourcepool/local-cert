import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { createProvider, listProviders } from '@/lib/dns/providers';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireAdminSession();
  return ok(await listProviders());
});

/** POST /api/admin/providers?force=true — tests the credentials, then stores them. */
export const POST = handler(async (req: Request) => {
  const session = await requireAdminSession();
  const force = new URL(req.url).searchParams.get('force') === 'true';
  const body = await req.json().catch(() => null);
  return ok(await createProvider(session, body, { force, req }), { status: 201 });
});

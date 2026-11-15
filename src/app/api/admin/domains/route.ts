import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { createDomain, listDomainsWithCounts } from '@/lib/admin/domains';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireAdminSession();
  return ok(await listDomainsWithCounts());
});

export const POST = handler(async (req: Request) => {
  const session = await requireAdminSession();
  const force = new URL(req.url).searchParams.get('force') === 'true';
  const body = await req.json().catch(() => null);
  return ok(await createDomain(session, body, { force, req }), { status: 201 });
});

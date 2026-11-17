import { handler, ok, problem } from '@/lib/http';
import { requireAuth, requireAdmin, audit } from '@/lib/auth/guard';
import { createEabSchema } from '@/lib/validation';
import { createEabKey, listEabKeys } from '@/lib/acme-server/eab';
import { urls } from '@/lib/acme-server/protocol';

export const dynamic = 'force-dynamic';

/*
 * Admin only, console session or admin key: a credential outlives whoever
 * created it, so letting a scoped key mint one would let it keep its access
 * past its own revocation.
 */

export const GET = handler(async (req: Request) => {
  requireAdmin(await requireAuth(req));
  return ok({ items: await listEabKeys() });
});

/** POST /api/v1/acme/eab — credentials an ACME client registers with at /acme/directory. */
export const POST = handler(async (req: Request) => {
  const principal = await requireAuth(req);
  requireAdmin(principal);
  const parsed = createEabSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return problem('validation_error', 'Invalid request body', parsed.error.issues);

  const created = await createEabKey(parsed.data, principal.keyId, urls(req).directory);
  await audit(principal.keyId, 'acme.eab.create', {
    target: created.id,
    detail: { name: created.name, domains: created.domains.map((d) => d.name) },
    req,
  });
  return ok(created, { status: 201, headers: { 'cache-control': 'no-store' } });
});

import { handler, ok, problem } from '@/lib/http';
import { requireAuth, audit } from '@/lib/auth/guard';
import { createEabSchema } from '@/lib/validation';
import { createEabKey, listEabKeys } from '@/lib/acme-server/eab';
import { urls } from '@/lib/acme-server/protocol';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request) => {
  const principal = await requireAuth(req);
  return ok({ items: await listEabKeys(principal) });
});

/** POST /api/v1/acme/eab — credentials an ACME client registers with at /acme/directory. */
export const POST = handler(async (req: Request) => {
  const principal = await requireAuth(req);
  // The body is optional: an API key binding itself has nothing to say.
  const text = await req.text();
  let body: unknown = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  const parsed = createEabSchema.safeParse(body);
  if (!parsed.success) return problem('validation_error', 'Invalid request body', parsed.error.issues);

  const created = await createEabKey(principal, parsed.data.api_key_id, urls(req).directory);
  await audit(principal.keyId, 'acme.eab.create', {
    target: created.id,
    detail: { api_key_id: created.api_key_id },
    req,
  });
  return ok(created, { status: 201, headers: { 'cache-control': 'no-store' } });
});

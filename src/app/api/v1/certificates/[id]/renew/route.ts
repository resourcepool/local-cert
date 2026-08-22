import { db, nowIso } from '@/lib/db';
import { handler, ok, ApiError } from '@/lib/http';
import { requireAuth, requireScope, audit } from '@/lib/auth/guard';
import { SCOPES } from '@/lib/scopes';
import { serializeCert } from '@/lib/certificates';
import { logEvent } from '@/lib/acme/issue';

export const dynamic = 'force-dynamic';

/** POST /api/v1/certificates/{id}/renew — re-queues the order immediately. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const principal = await requireAuth(req);
  const { id } = await ctx.params;

  const cert = await db()
    .selectFrom('certificates')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  if (!cert) throw new ApiError('not_found', 'Certificate not found');

  const domain = await db()
    .selectFrom('domains')
    .selectAll()
    .where('id', '=', cert.domain_id)
    .executeTakeFirstOrThrow();
  requireScope(principal, domain.id, SCOPES.CERT_RENEW);

  if (cert.locked_at) throw new ApiError('conflict', 'An issuance is already running for this certificate');
  if (cert.status === 'revoked') throw new ApiError('conflict', 'Certificate is revoked; create a new one');

  await db()
    .updateTable('certificates')
    .set({ status: 'pending', attempt: 0, next_attempt_at: null, last_error: null, updated_at: nowIso() })
    .where('id', '=', id)
    .execute();
  await logEvent(id, 'renew.requested', `Manual renewal by ${principal.name}`);
  await audit(principal.keyId, 'certificate.renew', { target: id, req });

  const updated = await db()
    .selectFrom('certificates')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  return ok(serializeCert(updated, domain.name), { status: 202, headers: { 'Retry-After': '15' } });
});

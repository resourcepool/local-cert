import { db, nowIso } from '@/lib/db';
import { handler, ok, problem, ApiError } from '@/lib/http';
import { requireAuth, requireScope, audit } from '@/lib/auth/guard';
import { SCOPES } from '@/lib/scopes';
import { serializeCert, parseMetadata } from '@/lib/certificates';
import { updateMetadataSchema } from '@/lib/validation';
import { revoke } from '@/lib/acme/issue';
import { cleanupCertificateRecords } from '@/lib/dns/cleanup';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
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
  return { cert, domain };
}

export const GET = handler(async (req: Request, ctx: Ctx) => {
  const principal = await requireAuth(req);
  const { cert, domain } = await load((await ctx.params).id);
  requireScope(principal, domain.id, SCOPES.CERT_READ);
  return ok(serializeCert(cert, domain.name));
});

/**
 * PATCH — updates the business metadata attached to a subdomain. Nothing else
 * about an issued certificate is mutable; re-issue instead.
 */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const principal = await requireAuth(req);
  const { cert, domain } = await load((await ctx.params).id);
  requireScope(principal, domain.id, SCOPES.CERT_ISSUE);

  const parsed = updateMetadataSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return problem('validation_error', 'Invalid metadata', parsed.error.issues);
  }

  const next =
    parsed.data.mode === 'replace'
      ? parsed.data.metadata
      : { ...parseMetadata(cert.metadata), ...parsed.data.metadata };

  await db()
    .updateTable('certificates')
    .set({ metadata: JSON.stringify(next), updated_at: nowIso() })
    .where('id', '=', cert.id)
    .execute();

  await audit(principal.keyId, 'certificate.metadata', {
    target: cert.id,
    detail: { mode: parsed.data.mode, keys: Object.keys(parsed.data.metadata) },
    req,
  });

  const updated = await db()
    .selectFrom('certificates')
    .selectAll()
    .where('id', '=', cert.id)
    .executeTakeFirstOrThrow();
  return ok(serializeCert(updated, domain.name));
});

/**
 * DELETE — revokes at the CA, removes the A record it created, then deletes the
 * row. Both external steps are best-effort: an unreachable CA or zone must not
 * strand the row, which would also pin its domain through the foreign key.
 * Anything left behind comes back in `warnings`.
 */
export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const principal = await requireAuth(req);
  const { cert, domain } = await load((await ctx.params).id);
  requireScope(principal, domain.id, SCOPES.CERT_REVOKE);

  const purge = new URL(req.url).searchParams.get('purge') === 'true';

  await revoke(cert.id);

  const warnings = await cleanupCertificateRecords(cert, domain);

  if (purge) {
    await db().deleteFrom('certificates').where('id', '=', cert.id).execute();
  } else {
    await db()
      .updateTable('certificates')
      .set({ updated_at: nowIso() })
      .where('id', '=', cert.id)
      .execute();
  }

  await audit(principal.keyId, purge ? 'certificate.purge' : 'certificate.revoke', {
    target: cert.id,
    req,
  });

  return ok({
    id: cert.id,
    status: purge ? 'deleted' : 'revoked',
    ...(warnings.length ? { warnings } : {}),
  });
});

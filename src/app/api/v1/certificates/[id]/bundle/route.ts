import { db } from '@/lib/db';
import { handler, ok, ApiError } from '@/lib/http';
import { requireAuth, requireScope, audit } from '@/lib/auth/guard';
import { SCOPES } from '@/lib/scopes';
import { decryptSecret } from '@/lib/crypto/secrets';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/certificates/{id}/bundle?format=json|pem&include=fullchain,key,cert,chain
 * Downloading key material needs cert:export on the domain, on top of cert:read.
 */
export const GET = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
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
    .select('id')
    .where('id', '=', cert.domain_id)
    .executeTakeFirstOrThrow();

  // Authorize before revealing anything about the certificate, including its
  // status — otherwise an unauthorized caller can probe which ids exist.
  requireScope(principal, domain.id, SCOPES.CERT_READ);

  if (cert.status !== 'issued') {
    throw new ApiError('conflict', `Certificate is "${cert.status}", no bundle available`);
  }

  const url = new URL(req.url);
  const include = new Set(
    (url.searchParams.get('include') ?? 'fullchain,key').split(',').map((s) => s.trim()),
  );
  const wantsKey = include.has('key');
  if (wantsKey) requireScope(principal, domain.id, SCOPES.CERT_EXPORT);

  const key = wantsKey && cert.private_key_enc ? decryptSecret(cert.private_key_enc) : null;
  const fullchain = `${cert.cert_pem ?? ''}${cert.chain_pem ?? ''}`;

  await audit(principal.keyId, 'certificate.export', {
    target: id,
    detail: { include: [...include] },
    req,
  });

  if (url.searchParams.get('format') === 'pem') {
    const parts: string[] = [];
    if (include.has('fullchain')) parts.push(fullchain);
    if (include.has('cert')) parts.push(cert.cert_pem ?? '');
    if (include.has('chain')) parts.push(cert.chain_pem ?? '');
    if (key) parts.push(key);
    return new Response(parts.join('\n'), {
      headers: {
        'content-type': 'application/x-pem-file',
        'content-disposition': `attachment; filename="${id}.pem"`,
        'cache-control': 'no-store',
      },
    });
  }

  return ok(
    {
      id,
      domains: JSON.parse(cert.domains),
      not_after: cert.not_after,
      ...(include.has('cert') ? { cert_pem: cert.cert_pem } : {}),
      ...(include.has('chain') ? { chain_pem: cert.chain_pem } : {}),
      ...(include.has('fullchain') ? { fullchain_pem: fullchain } : {}),
      ...(key ? { private_key_pem: key } : {}),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
});

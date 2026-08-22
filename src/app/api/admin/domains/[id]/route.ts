import { db } from '@/lib/db';
import { handler, ok, ApiError } from '@/lib/http';
import { requireAdminSession, audit } from '@/lib/auth/guard';
import { revoke } from '@/lib/acme/issue';
import { cleanupCertificateRecords } from '@/lib/dns/cleanup';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const ACTIVE = ['issued', 'pending', 'dns_propagating', 'validating'] as const;

/**
 * DELETE /api/admin/domains/{id}[?force=true]
 *
 * certificates.domain_id is ON DELETE RESTRICT, so *any* remaining certificate
 * row pins the domain — revoked, failed and expired ones included, not just the
 * active ones. Refusing on the active set alone let the delete through and then
 * die on a foreign key violation, which is what made revoked domains
 * unremovable.
 *
 * force=true does the cascade explicitly: revoke at the CA and clean the zone
 * where still possible, then drop the certificates and the domain in one
 * transaction. Both external steps are best-effort — the whole point is to be
 * able to clear out a domain whose API access is already gone.
 */
export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const session = await requireAdminSession();
  const { id } = await ctx.params;
  const force = new URL(req.url).searchParams.get('force') === 'true';

  const domain = await db()
    .selectFrom('domains')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  if (!domain) throw new ApiError('not_found', 'Domain not found');

  const certs = await db()
    .selectFrom('certificates')
    .select(['id', 'status', 'domains', 'dns_record'])
    .where('domain_id', '=', id)
    .execute();

  if (certs.length > 0 && !force) {
    const active = certs.filter((c) => (ACTIVE as readonly string[]).includes(c.status)).length;
    throw new ApiError(
      'conflict',
      `Domain still has ${certs.length} certificate(s) (${active} active). ` +
        'Delete them first, or repeat with ?force=true to remove them along with the domain.',
      {
        certificates: certs.length,
        active,
        by_status: certs.reduce<Record<string, number>>((acc, c) => {
          acc[c.status] = (acc[c.status] ?? 0) + 1;
          return acc;
        }, {}),
      },
    );
  }

  const warnings: string[] = [];
  for (const cert of certs) {
    // revoke() already swallows CA errors; cleanup swallows Route53 errors.
    await revoke(cert.id).catch((err) =>
      warnings.push(`Could not revoke ${cert.id}: ${(err as Error).message}`),
    );
    warnings.push(...(await cleanupCertificateRecords(cert, domain)));
  }

  await db()
    .transaction()
    .execute(async (trx) => {
      // certificate_events and grants cascade; certificates are RESTRICT, so
      // they have to go first and in the same transaction.
      await trx.deleteFrom('certificates').where('domain_id', '=', id).execute();
      await trx.deleteFrom('domains').where('id', '=', id).execute();
    });

  await audit(session.keyId, 'domain.delete', {
    target: id,
    detail: { name: domain.name, forced: force, certificates_removed: certs.length },
    req,
  });

  return ok({
    id,
    deleted: true,
    certificates_removed: certs.length,
    ...(warnings.length ? { warnings } : {}),
  });
});

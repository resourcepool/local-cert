import { db } from '@/lib/db';
import { handler, ok, problem } from '@/lib/http';
import { requireAuth, requireScope } from '@/lib/auth/guard';
import { SCOPES } from '@/lib/scopes';
import { fqdnSchema } from '@/lib/validation';
import { domainForFqdn, serializeCert } from '@/lib/certificates';
import { listRecords } from '@/lib/dns/route53';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/subdomains/{fqdn}
 *
 * Answers "is this subdomain taken?" from both sources of truth, because they
 * can disagree: a record may exist in the zone without local-cert knowing about
 * it (created by hand, or by another tool), and a certificate may exist here
 * with no record published.
 *
 * Requires cert:read on the covering domain. The DNS half is public data that
 * anyone can resolve with dig, so it is not gated any further.
 */
export const GET = handler(async (req: Request, ctx: { params: Promise<{ fqdn: string }> }) => {
  const principal = await requireAuth(req);

  const raw = decodeURIComponent((await ctx.params).fqdn);
  const parsed = fqdnSchema.safeParse(raw);
  if (!parsed.success) {
    return problem('validation_error', 'Invalid FQDN', parsed.error.issues);
  }
  const fqdn = parsed.data;

  const domain = await domainForFqdn(fqdn);
  requireScope(principal, domain.id, SCOPES.CERT_READ);

  const certRow = await db()
    .selectFrom('certificates')
    .selectAll()
    .where('domain_id', '=', domain.id)
    .where('status', '!=', 'revoked')
    .orderBy('created_at', 'desc')
    .execute()
    .then((rows) => rows.find((r) => (JSON.parse(r.domains) as string[]).includes(fqdn)));

  let dns: {
    exists: boolean;
    managed: boolean;
    records: Array<{ type: string; ttl: number | null; values: string[] }>;
    error?: string;
  };
  try {
    const all = await listRecords({
      zoneId: domain.route53_zone_id,
      region: domain.aws_region,
      roleArn: domain.aws_role_arn,
    });
    const matching = all.filter((r) => r.name === fqdn && !r.marker);
    dns = {
      exists: matching.length > 0,
      managed: matching.some((r) => r.managed),
      records: matching.map((r) => ({ type: r.type, ttl: r.ttl, values: r.values })),
    };
  } catch (err) {
    // A zone we cannot read must not turn a lookup into a hard failure; report
    // the unknown half instead of pretending the name is free.
    dns = { exists: false, managed: false, records: [], error: (err as Error).message };
  }

  const cert = certRow ? serializeCert(certRow, domain.name) : null;

  return ok({
    fqdn,
    /** free only when neither source knows the name and the zone was readable */
    available: !dns.exists && !cert && !dns.error,
    managed_domain: domain.name,
    dns,
    certificate: cert
      ? {
          id: cert.id,
          status: cert.status,
          not_after: cert.not_after,
          days_remaining: cert.days_remaining,
          metadata: cert.metadata,
          links: cert.links,
        }
      : null,
    metadata: cert?.metadata ?? {},
  });
});

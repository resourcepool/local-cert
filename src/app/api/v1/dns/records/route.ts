
import { handler, ok, problem, ApiError } from '@/lib/http';
import { requireAuth, requireScope, visibleDomainIds, audit } from '@/lib/auth/guard';
import { SCOPES } from '@/lib/scopes';
import { dnsRecordSchema } from '@/lib/validation';
import { domainForFqdn, listDomains } from '@/lib/certificates';
import { listRecords, upsertRecord, deleteRecord, waitForSync } from '@/lib/dns/route53';

export const dynamic = 'force-dynamic';

const zoneOf = (d: { route53_zone_id: string; aws_region: string; aws_role_arn: string | null }) => ({
  zoneId: d.route53_zone_id,
  region: d.aws_region,
  roleArn: d.aws_role_arn,
});

/** GET /api/v1/dns/records?domain_id= */
export const GET = handler(async (req: Request) => {
  const principal = await requireAuth(req);
  const url = new URL(req.url);
  const domainId = url.searchParams.get('domain_id');

  const visible = visibleDomainIds(principal);
  const all = await listDomains();
  const targets = all.filter(
    (d) => (visible === 'all' || visible.includes(d.id)) && (!domainId || d.id === domainId),
  );

  const items: unknown[] = [];
  for (const d of targets) {
    requireScope(principal, d.id, SCOPES.DNS_READ);
    const records = await listRecords(zoneOf(d));
    items.push({ domain_id: d.id, domain: d.name, records });
  }
  return ok({ items });
});

/** PUT /api/v1/dns/records — UPSERT one record. */
export const PUT = handler(async (req: Request) => {
  const principal = await requireAuth(req);
  const parsed = dnsRecordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return problem('validation_error', 'Invalid record', parsed.error.issues);
  const { fqdn, type, values, ttl } = parsed.data;

  const domain = await domainForFqdn(fqdn);
  requireScope(principal, domain.id, SCOPES.DNS_WRITE);

  if (fqdn.startsWith('_acme-challenge.')) {
    throw new ApiError('forbidden', '_acme-challenge records are managed by the issuance worker');
  }

  const changeId = await upsertRecord(zoneOf(domain), fqdn, type, values, ttl);
  await waitForSync(zoneOf(domain), changeId, 60_000).catch(() => {});
  await audit(principal.keyId, 'dns.upsert', { target: fqdn, detail: { type, values, ttl }, req });

  return ok({ fqdn, type, values, ttl, change_id: changeId });
});

/** DELETE /api/v1/dns/records?fqdn=&type=&values=a,b&ttl= */
export const DELETE = handler(async (req: Request) => {
  const principal = await requireAuth(req);
  const url = new URL(req.url);
  const parsed = dnsRecordSchema.safeParse({
    fqdn: url.searchParams.get('fqdn'),
    type: url.searchParams.get('type'),
    values: (url.searchParams.get('values') ?? '').split(',').filter(Boolean),
    ttl: Number(url.searchParams.get('ttl') ?? 60),
  });
  if (!parsed.success) return problem('validation_error', 'Invalid query', parsed.error.issues);
  const { fqdn, type, values, ttl } = parsed.data;

  const domain = await domainForFqdn(fqdn);
  requireScope(principal, domain.id, SCOPES.DNS_WRITE);

  await deleteRecord(zoneOf(domain), fqdn, type, values, ttl);
  await audit(principal.keyId, 'dns.delete', { target: fqdn, detail: { type }, req });

  return ok({ fqdn, type, deleted: true });
});


import { db } from '@/lib/db';
import { handler, ok, problem, ApiError } from '@/lib/http';
import { requireAuth, requireScope, visibleDomainIds, audit } from '@/lib/auth/guard';
import { SCOPES } from '@/lib/scopes';
import { createCertificateSchema } from '@/lib/validation';
import {
  createCertificate,
  domainForFqdn,
  findByIdempotencyKey,
  listDomains,
  serializeCert,
} from '@/lib/certificates';
import { upsertRecord } from '@/lib/dns/zone';
import { zoneFor } from '@/lib/dns/providers';
import { logEvent } from '@/lib/acme/issue';

export const dynamic = 'force-dynamic';

/** GET /api/v1/certificates?status=&domain=&expires_within_days= */
export const GET = handler(async (req: Request) => {
  const principal = await requireAuth(req);
  const url = new URL(req.url);
  const visible = visibleDomainIds(principal);

  let q = db().selectFrom('certificates').selectAll().orderBy('created_at', 'desc');
  if (visible !== 'all') {
    if (visible.length === 0) return ok({ items: [], total: 0 });
    q = q.where('domain_id', 'in', visible);
  }

  const status = url.searchParams.get('status');
  if (status) q = q.where('status', '=', status as never);

  const expiresWithin = url.searchParams.get('expires_within_days');
  if (expiresWithin) {
    const cutoff = new Date(Date.now() + Number(expiresWithin) * 86_400_000).toISOString();
    q = q.where('not_after', '<', cutoff);
  }

  const rows = await q.limit(Number(url.searchParams.get('limit') ?? 200)).execute();
  const domains = new Map((await listDomains()).map((d) => [d.id, d.name]));
  const domainFilter = url.searchParams.get('domain');

  // metadata.<key>=<value> — matched in application code rather than SQL: the
  // JSON operators differ between SQLite and Postgres and the column is not
  // indexed either way, so there is nothing to gain from pushing it down.
  const metaFilters = [...url.searchParams.entries()]
    .filter(([k]) => k.startsWith('metadata.'))
    .map(([k, v]) => [k.slice('metadata.'.length), v] as const);

  const items = rows
    .map((r) => serializeCert(r, domains.get(r.domain_id) ?? '?'))
    .filter((c) => !domainFilter || c.domains.some((d) => d.includes(domainFilter)))
    .filter((c) => metaFilters.every(([k, v]) => c.metadata[k] === v));

  return ok({ items, total: items.length });
});

/** POST /api/v1/certificates — enqueues an issuance, returns 202. */
export const POST = handler(async (req: Request) => {
  const principal = await requireAuth(req);
  const body = await req.json().catch(() => null);
  const parsed = createCertificateSchema.safeParse(body);
  if (!parsed.success) {
    return problem('validation_error', 'Invalid request body', parsed.error.issues);
  }
  const input = parsed.data;

  const idemHeader = req.headers.get('idempotency-key');
  if (idemHeader) {
    const existing = await findByIdempotencyKey(idemHeader, principal.keyId);
    if (existing) {
      const domain = await db()
        .selectFrom('domains')
        .select('name')
        .where('id', '=', existing.domain_id)
        .executeTakeFirst();
      return ok(serializeCert(existing, domain?.name ?? '?'), {
        status: 200,
        headers: { 'Idempotent-Replay': 'true' },
      });
    }
  }

  // Every SAN must live under the same managed domain — one Route53 zone per order.
  const domain = await domainForFqdn(input.domains[0]);
  for (const name of input.domains) {
    const d = await domainForFqdn(name);
    if (d.id !== domain.id) {
      throw new ApiError(
        'validation_error',
        `All SANs must belong to a single managed domain (${name} -> ${d.name}, expected ${domain.name})`,
      );
    }
  }
  requireScope(principal, domain.id, SCOPES.CERT_ISSUE);

  const cert = await createCertificate({
    domains: input.domains,
    domainId: domain.id,
    keyType: input.key_type,
    autoRenew: input.auto_renew,
    renewBeforeDays: input.renew_before_days,
    webhookUrl: input.webhook_url ?? null,
    metadata: input.metadata,
    dnsRecord: input.dns ?? null,
    createdBy: principal.keyId,
    idempotencyKey: idemHeader ? `${principal.keyId}:${idemHeader}` : null,
  });

  // Optional convenience: publish the A record pointing at the LAN IP.
  // Purely cosmetic for ACME (dns-01 never resolves the name) but it is what
  // makes https://nas.home.example.com actually reachable from the LAN.
  if (input.dns?.create_record && input.dns.target_ip) {
    requireScope(principal, domain.id, SCOPES.DNS_WRITE);
    const target = input.domains.find((d) => !d.startsWith('*.'));
    if (target) {
      await upsertRecord(
        await zoneFor(domain),
        target,
        'A',
        [input.dns.target_ip],
        input.dns.ttl,
      );
      await logEvent(cert.id, 'dns.a_record', `A ${target} -> ${input.dns.target_ip}`);
    }
  }

  await audit(principal.keyId, 'certificate.create', {
    target: cert.id,
    detail: { domains: input.domains },
    req,
  });

  return ok(serializeCert(cert, domain.name), {
    status: 202,
    headers: {
      Location: `/api/v1/certificates/${cert.id}`,
      'Retry-After': '15',
    },
  });
});

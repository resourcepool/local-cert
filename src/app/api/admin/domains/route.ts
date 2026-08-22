import { db, nowIso } from '@/lib/db';
import { handler, ok, problem, ApiError } from '@/lib/http';
import { requireAdminSession, audit } from '@/lib/auth/guard';
import { randomId } from '@/lib/crypto/secrets';
import { createDomainSchema } from '@/lib/validation';
import { preflightZone } from '@/lib/dns/preflight';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireAdminSession();
  const domains = await db().selectFrom('domains').selectAll().orderBy('name').execute();
  const counts = await db()
    .selectFrom('certificates')
    .select(['domain_id', (eb) => eb.fn.countAll<number>().as('n')])
    .groupBy('domain_id')
    .execute();
  const byDomain = new Map(counts.map((c) => [c.domain_id, Number(c.n)]));
  return ok({
    items: domains.map((d) => ({ ...d, certificate_count: byDomain.get(d.id) ?? 0 })),
  });
});

export const POST = handler(async (req: Request) => {
  const session = await requireAdminSession();
  const parsed = createDomainSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return problem('validation_error', 'Invalid domain', parsed.error.issues);
  const input = parsed.data;

  const existing = await db()
    .selectFrom('domains')
    .select('id')
    .where('name', '=', input.name)
    .executeTakeFirst();
  if (existing) throw new ApiError('conflict', `Domain "${input.name}" is already managed`);

  // Full permission preflight before the domain lands in the DB: a partial
  // policy (the classic one is TXT missing, which makes DNS-01 impossible)
  // otherwise only surfaces at the first issuance, minutes later and buried in
  // an order's event log.
  const zone = {
    zoneId: input.route53_zone_id,
    region: input.aws_region,
    roleArn: input.aws_role_arn ?? null,
  };
  const preflight = await preflightZone(zone);
  const force = new URL(req.url).searchParams.get('force') === 'true';

  // The zone apex has to actually contain the declared base name, or every
  // issuance would target a zone that cannot answer for it.
  if (
    preflight.zoneName &&
    input.name !== preflight.zoneName &&
    !input.name.endsWith(`.${preflight.zoneName}`)
  ) {
    throw new ApiError(
      'validation_error',
      `Hosted zone ${input.route53_zone_id} serves "${preflight.zoneName}", which does not cover "${input.name}"`,
      { zone_name: preflight.zoneName, declared: input.name },
    );
  }

  if (!preflight.ok && !force) {
    throw new ApiError(
      'forbidden',
      `Route53 permissions are incomplete: ${preflight.failures.map((f) => f.label).join(', ')}. ` +
        'Fix the IAM policy (see docs/iam-policy.json), or repeat with ?force=true to register anyway.',
      { zone_name: preflight.zoneName, checks: preflight.checks },
    );
  }

  const row = {
    id: randomId('dom'),
    name: input.name,
    route53_zone_id: input.route53_zone_id,
    aws_role_arn: input.aws_role_arn ?? null,
    aws_region: input.aws_region,
    default_ttl: input.default_ttl,
    created_at: nowIso(),
  };
  await db().insertInto('domains').values(row).execute();
  await audit(session.keyId, 'domain.create', {
    target: row.id,
    detail: { name: row.name, preflight_ok: preflight.ok, forced: force },
    req,
  });

  const warnings = preflight.checks
    .filter((c) => !c.required && !c.ok)
    .map((c) => `${c.label}: ${c.note}. ${c.why ?? ''}`.trim());

  return ok(
    { ...row, preflight: preflight.checks, ...(warnings.length ? { warnings } : {}) },
    { status: 201 },
  );
});

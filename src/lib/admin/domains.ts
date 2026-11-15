import { db, nowIso } from '@/lib/db';
import { ApiError } from '@/lib/http';
import { audit, type Principal } from '@/lib/auth/guard';
import { randomId } from '@/lib/crypto/secrets';
import { createDomainSchema } from '@/lib/validation';
import { preflightZone } from '@/lib/dns/preflight';
import { revoke } from '@/lib/acme/issue';
import { cleanupCertificateRecords } from '@/lib/dns/cleanup';

/**
 * Domain administration, shared by the console routes (/api/admin/domains) and
 * the MCP admin tools. Callers authenticate and check admin rights; nothing in
 * here does.
 */

const ACTIVE = ['issued', 'pending', 'dns_propagating', 'validating'] as const;

export async function listDomainsWithCounts() {
  const domains = await db().selectFrom('domains').selectAll().orderBy('name').execute();
  const counts = await db()
    .selectFrom('certificates')
    .select(['domain_id', (eb) => eb.fn.countAll<number>().as('n')])
    .groupBy('domain_id')
    .execute();
  const byDomain = new Map(counts.map((c) => [c.domain_id, Number(c.n)]));
  return {
    items: domains.map((d) => ({ ...d, certificate_count: byDomain.get(d.id) ?? 0 })),
  };
}

export async function createDomain(
  actor: Principal,
  body: unknown,
  opts: { force?: boolean; req?: Request } = {},
) {
  const parsed = createDomainSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError('validation_error', 'Invalid domain', parsed.error.issues);
  }
  const input = parsed.data;
  const force = opts.force === true;

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
  await audit(actor.keyId, 'domain.create', {
    target: row.id,
    detail: { name: row.name, preflight_ok: preflight.ok, forced: force },
    req: opts.req,
  });

  const warnings = preflight.checks
    .filter((c) => !c.required && !c.ok)
    .map((c) => `${c.label}: ${c.note}. ${c.why ?? ''}`.trim());

  return { ...row, preflight: preflight.checks, ...(warnings.length ? { warnings } : {}) };
}

/**
 * certificates.domain_id is ON DELETE RESTRICT, so *any* remaining certificate
 * row pins the domain — revoked, failed and expired ones included, not just the
 * active ones. Refusing on the active set alone let the delete through and then
 * die on a foreign key violation, which is what made revoked domains
 * unremovable.
 *
 * force does the cascade explicitly: revoke at the CA and clean the zone where
 * still possible, then drop the certificates and the domain in one transaction.
 * Both external steps are best-effort — the whole point is to be able to clear
 * out a domain whose API access is already gone.
 */
export async function deleteDomain(
  actor: Principal,
  id: string,
  opts: { force?: boolean; req?: Request } = {},
) {
  const force = opts.force === true;

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

  await audit(actor.keyId, 'domain.delete', {
    target: id,
    detail: { name: domain.name, forced: force, certificates_removed: certs.length },
    req: opts.req,
  });

  return {
    id,
    deleted: true,
    certificates_removed: certs.length,
    ...(warnings.length ? { warnings } : {}),
  };
}

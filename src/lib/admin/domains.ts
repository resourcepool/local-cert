import { db, nowIso } from '@/lib/db';
import { ApiError } from '@/lib/http';
import { audit, type Principal } from '@/lib/auth/guard';
import { randomId } from '@/lib/crypto/secrets';
import { createDomainSchema } from '@/lib/validation';
import { preflightZone, type PreflightCheck } from '@/lib/dns/zone';
import { isDraftProvider, providerZone, zoneFor } from '@/lib/dns/providers';
import type { DomainsTable } from '@/lib/db/types';
import { revoke } from '@/lib/acme/issue';
import { cleanupCertificateRecords } from '@/lib/dns/cleanup';

/**
 * Domain administration, shared by the console routes (/api/admin/domains) and
 * the MCP admin tools. Callers authenticate and check admin rights; nothing in
 * here does.
 */

const ACTIVE = ['issued', 'pending', 'dns_propagating', 'validating'] as const;

/** A pending domain is re-tested once a minute, five times, then gives up. */
export const DOMAIN_CHECK_INTERVAL_MS = 60_000;
export const DOMAIN_CHECK_MAX = 5;

const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();

const summarise = (failures: PreflightCheck[]) =>
  failures.map((f) => `${f.label}: ${f.note}`).join(' · ').slice(0, 600);

export async function listDomainsWithCounts() {
  const domains = await db().selectFrom('domains').selectAll().orderBy('name').execute();
  const counts = await db()
    .selectFrom('certificates')
    .select(['domain_id', (eb) => eb.fn.countAll<number>().as('n')])
    .groupBy('domain_id')
    .execute();
  const byDomain = new Map(counts.map((c) => [c.domain_id, Number(c.n)]));
  const providers = await db().selectFrom('dns_providers').select(['id', 'name', 'type']).execute();
  const providerName = new Map(providers.map((p) => [p.id, p.name]));
  const providerType = new Map(providers.map((p) => [p.id, p.type]));
  return {
    items: domains.map((d) => ({
      ...d,
      provider_name: d.provider_id ? (providerName.get(d.provider_id) ?? null) : null,
      provider_type: d.provider_id ? (providerType.get(d.provider_id) ?? null) : null,
      certificate_count: byDomain.get(d.id) ?? 0,
    })),
  };
}

/**
 * Validates a domain declaration and probes its zone, without writing anything.
 *
 * Full permission preflight before the domain lands in the DB: a partial
 * policy (the classic one is TXT missing, which makes DNS-01 impossible)
 * otherwise only surfaces at the first issuance, minutes later and buried in
 * an order's event log.
 */
async function inspect(body: unknown) {
  const parsed = createDomainSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError('validation_error', 'Invalid domain', parsed.error.issues);
  }
  const input = parsed.data;

  const existing = await db()
    .selectFrom('domains')
    .select('id')
    .where('name', '=', input.name)
    .executeTakeFirst();
  if (existing) throw new ApiError('conflict', `Domain "${input.name}" is already managed`);

  // With a provider, region and role are the provider's: the per-domain
  // fields are only honoured for provider-less (ambient credential) domains.
  if (input.provider_id && (await isDraftProvider(input.provider_id))) {
    throw new ApiError(
      'validation_error',
      'This DNS provider is still a draft. Finish its creation under Providers first.',
    );
  }
  const zone = input.provider_id
    ? await providerZone(input.provider_id, input.route53_zone_id)
    : {
        zoneId: input.route53_zone_id,
        region: input.aws_region,
        roleArn: input.aws_role_arn ?? null,
      };
  const preflight = await preflightZone(zone);

  // The zone apex has to actually contain the declared base name, or every
  // issuance would target a zone that cannot answer for it.
  const covers =
    !preflight.zoneName ||
    input.name === preflight.zoneName ||
    input.name.endsWith(`.${preflight.zoneName}`);

  return { input, zone, preflight, covers };
}

/** Dry run of createDomain: the same checks, nothing stored. */
export async function preflightDomain(body: unknown) {
  const { input, preflight, covers } = await inspect(body);
  return {
    name: input.name,
    route53_zone_id: input.route53_zone_id,
    zone_name: preflight.zoneName,
    covers,
    ok: preflight.ok && covers,
    checks: preflight.checks,
  };
}

export async function createDomain(
  actor: Principal,
  body: unknown,
  opts: { force?: boolean; pending?: boolean; req?: Request } = {},
) {
  const force = opts.force === true;
  const pending = opts.pending === true;
  const { input, zone, preflight, covers } = await inspect(body);

  if (!covers) {
    throw new ApiError(
      'validation_error',
      `Hosted zone ${input.route53_zone_id} serves "${preflight.zoneName}", which does not cover "${input.name}"`,
      { zone_name: preflight.zoneName, declared: input.name },
    );
  }

  if (!preflight.ok && !force && !pending) {
    throw new ApiError(
      'forbidden',
      `Route53 permissions are incomplete: ${preflight.failures.map((f) => f.label).join(', ')}. ` +
        'Fix the IAM policy (the console generates it under Domaines, see also docs/iam-policy.json), ' +
        'repeat with ?pending=true to register it now and let local-cert re-test it for a few minutes, ' +
        'or with ?force=true to register it as active anyway.',
      { zone_name: preflight.zoneName, checks: preflight.checks },
    );
  }

  const row = {
    id: randomId('dom'),
    name: input.name,
    route53_zone_id: input.route53_zone_id,
    aws_role_arn: input.provider_id ? null : (input.aws_role_arn ?? null),
    // only meaningful for Route53; other hosts have no region
    aws_region: 'region' in zone ? zone.region : input.aws_region,
    default_ttl: input.default_ttl,
    created_at: nowIso(),
    provider_id: input.provider_id ?? null,
    // pending wins over force: an unverified domain that waits is safer than
    // one that takes orders it cannot fulfil
    ...(preflight.ok || !pending
      ? { status: 'active' as const, next_check_at: null, check_error: null }
      : {
          status: 'pending' as const,
          next_check_at: inMs(DOMAIN_CHECK_INTERVAL_MS),
          check_error: summarise(preflight.failures),
        }),
    check_attempts: 0,
    checked_at: nowIso(),
  };
  await db().insertInto('domains').values(row).execute();
  await audit(actor.keyId, 'domain.create', {
    target: row.id,
    detail: {
      name: row.name,
      provider_id: row.provider_id,
      preflight_ok: preflight.ok,
      status: row.status,
      forced: force,
    },
    req: opts.req,
  });

  const warnings = preflight.checks
    .filter((c) => !c.required && !c.ok)
    .map((c) => `${c.label}: ${c.note}. ${c.why ?? ''}`.trim());

  return { ...row, preflight: preflight.checks, ...(warnings.length ? { warnings } : {}) };
}

/* ------------------------------------------------------------ zone check */

/** Tests a registered domain's zone; never throws. */
async function checkZone(
  domain: DomainsTable,
): Promise<{ ok: boolean; error: string | null; checks: PreflightCheck[] }> {
  try {
    const preflight = await preflightZone(await zoneFor(domain));
    if (
      preflight.zoneName &&
      domain.name !== preflight.zoneName &&
      !domain.name.endsWith(`.${preflight.zoneName}`)
    ) {
      return {
        ok: false,
        error: `The zone serves "${preflight.zoneName}", which does not cover "${domain.name}"`,
        checks: preflight.checks,
      };
    }
    return {
      ok: preflight.ok,
      error: preflight.ok ? null : summarise(preflight.failures),
      checks: preflight.checks,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message.slice(0, 600), checks: [] };
  }
}

/**
 * Worker sweep: re-tests every pending domain whose minute is up. A passing
 * test activates the domain; the fifth failing one parks it in 'error', where
 * it stays until an operator restarts the check.
 */
export async function sweepPendingDomains(): Promise<void> {
  const due = await db()
    .selectFrom('domains')
    .selectAll()
    .where('status', '=', 'pending')
    .where('next_check_at', '<=', nowIso())
    .execute();
  for (const domain of due) {
    const result = await checkZone(domain);
    const attempts = domain.check_attempts + 1;
    const gaveUp = !result.ok && attempts >= DOMAIN_CHECK_MAX;
    await db()
      .updateTable('domains')
      .set({
        status: result.ok ? 'active' : gaveUp ? 'error' : 'pending',
        check_attempts: attempts,
        checked_at: nowIso(),
        check_error: result.error,
        next_check_at: result.ok || gaveUp ? null : inMs(DOMAIN_CHECK_INTERVAL_MS),
      })
      .where('id', '=', domain.id)
      // an operator may have restarted or removed it meanwhile
      .where('status', '=', 'pending')
      .execute();
    if (result.ok || gaveUp) {
      console.log(
        `[worker] domain ${domain.name}: ${result.ok ? 'rights verified, active' : `still failing after ${attempts} checks, parked`}`,
      );
    }
  }
}

/**
 * Operator-triggered check: tests now, and on failure starts a fresh cycle of
 * automatic checks. This is the way out of 'error'.
 */
export async function recheckDomain(actor: Principal, id: string, opts: { req?: Request } = {}) {
  const domain = await db().selectFrom('domains').selectAll().where('id', '=', id).executeTakeFirst();
  if (!domain) throw new ApiError('not_found', 'Domain not found');

  const result = await checkZone(domain);
  const update = {
    status: result.ok ? ('active' as const) : ('pending' as const),
    check_attempts: 0,
    checked_at: nowIso(),
    check_error: result.error,
    next_check_at: result.ok ? null : inMs(DOMAIN_CHECK_INTERVAL_MS),
  };
  await db().updateTable('domains').set(update).where('id', '=', id).execute();
  await audit(actor.keyId, 'domain.check', {
    target: id,
    detail: { name: domain.name, from: domain.status, to: update.status },
    req: opts.req,
  });
  return { ...domain, ...update, preflight: result.checks };
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

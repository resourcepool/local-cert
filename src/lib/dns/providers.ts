import 'server-only';
import { Route53Client, ListHostedZonesCommand } from '@aws-sdk/client-route-53';
import { db, nowIso } from '@/lib/db';
import type { DnsProvidersTable, DomainsTable } from '@/lib/db/types';
import { ApiError } from '@/lib/http';
import { audit, type Principal } from '@/lib/auth/guard';
import { decryptSecret, encryptSecret, randomId } from '@/lib/crypto/secrets';
import {
  createProviderSchema,
  probeProviderSchema,
  updateProviderSchema,
} from '@/lib/validation';
import {
  assumePolicy,
  isIamUserArn,
  permissionsPolicy,
  trustPolicy,
  type PolicyDocument,
} from './aws-policy';
import { clientFor } from './route53';
import { DRIVERS, type AwsZone, type ZoneConfig } from './zone';
import { DriverError, type DriverConfig } from './drivers/types';
import { envAuth, envRemoteConfig } from './env-providers';
import { PROVIDER_INFO, type ProviderType, type RemoteProviderType } from './provider-types';

/**
 * DNS provider accounts: the credentials a set of domains is managed with.
 *
 * One row is one identity on one account at a DNS host — "aws-prod", "ovh-perso".
 * Several rows of the same type are the normal case. AWS carries a key pair and
 * an optional role; every other host carries the fields its entry in
 * provider-types.ts lists, non-secret ones in `config.settings`, secret ones
 * encrypted together in `secret_enc`.
 *
 * Shared by the console routes and anything else that needs a zone's
 * credentials. Callers authenticate; nothing in here does.
 */

export interface AwsProviderConfig {
  /** null: no stored key pair, the process credential chain is used */
  access_key_id: string | null;
  role_arn: string | null;
  region: string;
  /** discovered by the last successful GetCallerIdentity */
  account_id: string | null;
  principal_arn: string | null;
  /** creation not finished: credentials stored, role and rights still pending */
  draft: boolean;
  /** PROVIDER_<TYPE>_<env_key>_*: declared in the environment, read-only here */
  env_key: string | null;
  /** non-AWS hosts: the non-secret fields of provider-types.ts */
  settings: Record<string, string>;
}

type Auth = NonNullable<AwsZone['auth']>;

function configOf(row: Pick<DnsProvidersTable, 'config'>): AwsProviderConfig {
  const raw = JSON.parse(row.config) as Partial<AwsProviderConfig>;
  return {
    access_key_id: raw.access_key_id ?? null,
    role_arn: raw.role_arn ?? null,
    region: raw.region ?? 'us-east-1',
    account_id: raw.account_id ?? null,
    principal_arn: raw.principal_arn ?? null,
    draft: raw.draft === true,
    env_key: raw.env_key ?? null,
    settings: raw.settings ?? {},
  };
}

const isRemote = (type: ProviderType): type is RemoteProviderType => type !== 'aws';

/** Settings and secrets of a non-AWS provider, as its driver wants them. */
function remoteCfg(row: DnsProvidersTable): DriverConfig {
  const config = configOf(row);
  if (config.env_key) return envRemoteConfig(row.type as RemoteProviderType, config.env_key);
  const secrets = row.secret_enc
    ? (JSON.parse(decryptSecret(row.secret_enc)) as Record<string, string>)
    : {};
  return { ...config.settings, ...secrets };
}

/**
 * Checks submitted fields against the host's entry in provider-types.ts and
 * separates what is stored in clear from what is encrypted. `partial` is an
 * update: absent fields keep their stored value.
 */
function splitFields(
  type: RemoteProviderType,
  input: Record<string, string> | undefined,
  partial = false,
): { settings: Record<string, string>; secrets: Record<string, string> } {
  const info = PROVIDER_INFO[type];
  const given = input ?? {};
  const unknown = Object.keys(given).filter((k) => !info.fields.some((f) => f.key === k));
  if (unknown.length > 0) {
    throw new ApiError('validation_error', `Unknown ${info.label} field(s): ${unknown.join(', ')}`);
  }
  const settings: Record<string, string> = {};
  const secrets: Record<string, string> = {};
  const missing: string[] = [];
  for (const field of info.fields) {
    const value = (given[field.key] ?? '').trim();
    if (!value) {
      if (field.required && !partial) missing.push(field.key);
      continue;
    }
    if (field.options && !field.options.some((o) => o.value === value)) {
      throw new ApiError(
        'validation_error',
        `${field.key} must be one of: ${field.options.map((o) => o.value).join(', ')}`,
      );
    }
    (field.secret ? secrets : settings)[field.key] = value;
  }
  if (missing.length > 0) {
    throw new ApiError('validation_error', `Missing ${info.label} field(s): ${missing.join(', ')}`);
  }
  return { settings, secrets };
}

function authOf(row: DnsProvidersTable): Auth | null {
  const config = configOf(row);
  // An environment provider's secret never reaches the database.
  if (config.env_key) return envAuth(config.env_key);
  if (!config.access_key_id || !row.secret_enc) return null;
  return { accessKeyId: config.access_key_id, secretAccessKey: decryptSecret(row.secret_enc) };
}

async function getProvider(id: string): Promise<DnsProvidersTable> {
  const row = await db()
    .selectFrom('dns_providers')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  if (!row) throw new ApiError('not_found', 'DNS provider not found');
  return row;
}

export async function isDraftProvider(id: string): Promise<boolean> {
  return configOf(await getProvider(id)).draft;
}

/* ------------------------------------------------------- zone resolution */

/** Credentials + zone for a hosted zone that is not (yet) a managed domain. */
export async function providerZone(providerId: string, zoneId: string): Promise<ZoneConfig> {
  const row = await getProvider(providerId);
  if (isRemote(row.type)) return { kind: row.type, zoneId, cfg: remoteCfg(row) };
  const config = configOf(row);
  return { zoneId, region: config.region, roleArn: config.role_arn, auth: authOf(row) };
}

/**
 * The one place a managed domain turns into something Route53 calls can use.
 * A domain without provider keeps its pre-provider behaviour: ambient
 * credentials plus its own optional role.
 */
export async function zoneFor(
  domain: Pick<DomainsTable, 'route53_zone_id' | 'aws_region' | 'aws_role_arn' | 'provider_id'>,
): Promise<ZoneConfig> {
  if (domain.provider_id) return providerZone(domain.provider_id, domain.route53_zone_id);
  return {
    zoneId: domain.route53_zone_id,
    region: domain.aws_region,
    roleArn: domain.aws_role_arn,
  };
}

/* ------------------------------------------------------------------ view */

export interface ProviderView {
  id: string;
  name: string;
  type: ProviderType;
  /** non-AWS hosts: their non-secret fields */
  settings: Record<string, string>;
  credentials: 'static' | 'ambient';
  access_key_id: string | null;
  role_arn: string | null;
  region: string;
  account_id: string | null;
  principal_arn: string | null;
  draft: boolean;
  /** 'env': declared by PROVIDER_AWS_<env_key>_*, cannot be edited or removed here */
  managed: 'env' | null;
  env_key: string | null;
  domain_count: number;
  created_at: string;
  updated_at: string;
}

function view(row: DnsProvidersTable, domainCount: number): ProviderView {
  const config = configOf(row);
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    settings: config.settings,
    credentials: isRemote(row.type) || authOf(row) ? 'static' : 'ambient',
    access_key_id: config.access_key_id,
    role_arn: config.role_arn,
    region: config.region,
    account_id: config.account_id,
    principal_arn: config.principal_arn,
    draft: config.draft,
    managed: config.env_key ? 'env' : null,
    env_key: config.env_key,
    domain_count: domainCount,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function domainCounts(): Promise<Map<string, number>> {
  const rows = await db()
    .selectFrom('domains')
    .select(['provider_id', (eb) => eb.fn.countAll<number>().as('n')])
    .where('provider_id', 'is not', null)
    .groupBy('provider_id')
    .execute();
  return new Map(rows.map((r) => [r.provider_id as string, Number(r.n)]));
}

export async function listProviders(): Promise<{ items: ProviderView[] }> {
  const rows = await db().selectFrom('dns_providers').selectAll().orderBy('name').execute();
  const counts = await domainCounts();
  return { items: rows.map((r) => view(r, counts.get(r.id) ?? 0)) };
}

/* ----------------------------------------------------------------- probe */

export interface ProbeStep {
  ok: boolean;
  note: string;
}

export interface ProbeResult {
  ok: boolean;
  /** GetCallerIdentity with the key pair — proves the keys, needs no permission */
  identity: ProbeStep & { arn: string | null; account: string | null };
  /** AssumeRole; null when the provider has no role */
  role: ProbeStep | null;
  /** ListHostedZones with the final credentials */
  zones: ProbeStep & { count: number | null; truncated: boolean };
  /** AWS only: what to paste into IAM, generated from what the probe discovered */
  policies: {
    trust: PolicyDocument | null;
    assume: PolicyDocument | null;
    permissions: PolicyDocument;
  } | null;
}

interface ProbeTarget {
  auth: Auth | null;
  roleArn: string | null;
  region: string;
  /** zones the generated permissions policy must already cover */
  zoneIds: string[];
  /** false for environment providers: they are never cleaned up from here */
  removable?: boolean;
}

function explain(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  const msg = err instanceof Error ? err.message : String(err);
  if (/InvalidClientTokenId|UnrecognizedClient/i.test(name)) return 'Unknown access key id';
  if (/SignatureDoesNotMatch/i.test(name)) return 'Secret access key does not match the key id';
  if (/CredentialsProviderError/i.test(name)) return 'No AWS credentials found in the environment';
  if (/AccessDenied/i.test(name) || /not authorized/i.test(msg)) {
    return `AccessDenied: ${msg.slice(0, 220)}`;
  }
  return `${name || 'error'}: ${msg.slice(0, 220)}`;
}

async function probe(target: ProbeTarget): Promise<ProbeResult> {
  const { STSClient, GetCallerIdentityCommand, AssumeRoleCommand } = await import(
    '@aws-sdk/client-sts'
  );
  const base = { region: target.region, credentials: target.auth ?? undefined };
  const sts = new STSClient(base);

  const identity: ProbeResult['identity'] = { ok: false, note: '', arn: null, account: null };
  try {
    const who = await sts.send(new GetCallerIdentityCommand({}));
    identity.ok = true;
    identity.arn = who.Arn ?? null;
    identity.account = who.Account ?? null;
    identity.note = who.Arn ?? 'authenticated';
  } catch (err) {
    identity.note = explain(err);
  }

  // Each step only runs on top of a working previous one; a skipped step says
  // so rather than reporting a failure that is really the previous step's.
  let role: ProbeResult['role'] = null;
  let final: ConstructorParameters<typeof Route53Client>[0] | null = identity.ok ? base : null;
  if (target.roleArn) {
    role = { ok: false, note: 'skipped — the key pair was rejected' };
    if (identity.ok) {
      try {
        const res = await sts.send(
          new AssumeRoleCommand({
            RoleArn: target.roleArn,
            RoleSessionName: 'local-cert-probe',
            DurationSeconds: 900,
          }),
        );
        const c = res.Credentials;
        if (!c?.AccessKeyId || !c.SecretAccessKey) throw new Error('AssumeRole returned no credentials');
        role = { ok: true, note: 'assumed' };
        final = {
          region: target.region,
          credentials: {
            accessKeyId: c.AccessKeyId,
            secretAccessKey: c.SecretAccessKey,
            sessionToken: c.SessionToken,
          },
        };
      } catch (err) {
        role = { ok: false, note: explain(err) };
        final = null;
      }
    }
  }

  const zones: ProbeResult['zones'] = {
    ok: false,
    note: 'skipped — no working credentials',
    count: null,
    truncated: false,
  };
  if (final) {
    try {
      const res = await new Route53Client(final).send(new ListHostedZonesCommand({ MaxItems: 100 }));
      zones.ok = true;
      zones.count = res.HostedZones?.length ?? 0;
      zones.truncated = res.IsTruncated === true;
      zones.note = `${zones.count}${zones.truncated ? '+' : ''} hosted zone(s) visible`;
    } catch (err) {
      zones.note = explain(err);
    }
  }

  return {
    ok: identity.ok && (role?.ok ?? true) && zones.ok,
    identity,
    role,
    zones,
    policies: {
      trust: identity.arn ? trustPolicy(identity.arn) : null,
      assume: target.roleArn ? assumePolicy(target.roleArn) : null,
      permissions: permissionsPolicy(
        target.zoneIds,
        target.removable === false
          ? undefined
          : { userArn: identity.arn, roleArn: target.roleArn },
      ),
    },
  };
}

/** One call proves both the credentials and the right to see zones. */
async function probeRemote(type: RemoteProviderType, cfg: DriverConfig): Promise<ProbeResult> {
  const label = PROVIDER_INFO[type].label;
  try {
    const zones = await DRIVERS[type].listZones(cfg);
    return {
      ok: true,
      identity: { ok: true, note: `authenticated with ${label}`, arn: null, account: null },
      role: null,
      zones: {
        ok: true,
        note: `${zones.length} zone(s) visible`,
        count: zones.length,
        truncated: false,
      },
      policies: null,
    };
  } catch (err) {
    const note = err instanceof Error ? err.message : String(err);
    const denied = err instanceof DriverError && err.denied;
    return {
      ok: false,
      identity: {
        ok: false,
        note: denied ? `credentials refused — ${note}` : note,
        arn: null,
        account: null,
      },
      role: null,
      zones: { ok: false, note: 'skipped — no working credentials', count: null, truncated: false },
      policies: null,
    };
  }
}

async function zoneIdsOf(providerId: string): Promise<string[]> {
  const rows = await db()
    .selectFrom('domains')
    .select('route53_zone_id')
    .where('provider_id', '=', providerId)
    .execute();
  return [...new Set(rows.map((r) => r.route53_zone_id))];
}

/** Tests credentials without storing anything. */
export async function probeProvider(body: unknown): Promise<ProbeResult> {
  const parsed = probeProviderSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError('validation_error', 'Invalid provider credentials', parsed.error.issues);
  }
  const input = parsed.data;

  const stored = input.provider_id ? await getProvider(input.provider_id) : null;
  const type: ProviderType = stored?.type ?? input.type ?? 'aws';
  if (isRemote(type)) {
    // Fields left blank fall back to the stored ones: a new token can be tried
    // without retyping everything else.
    const given = splitFields(type, input.settings, stored !== null);
    return probeRemote(type, {
      ...(stored ? remoteCfg(stored) : {}),
      ...given.settings,
      ...given.secrets,
    });
  }

  let auth: Auth | null =
    input.access_key_id && input.secret_access_key
      ? { accessKeyId: input.access_key_id, secretAccessKey: input.secret_access_key }
      : null;
  let roleArn = input.role_arn ?? null;
  let region = input.region;
  let zoneIds: string[] = [];

  if (stored) {
    const row = stored;
    const config = configOf(row);
    auth ??= authOf(row);
    // An explicit null means "try without the role"; absent means "as stored".
    if (input.role_arn === undefined) roleArn = config.role_arn;
    region = config.region;
    zoneIds = await zoneIdsOf(row.id);

    // A test of the provider as stored is also what teaches us who it is —
    // environment providers have no other moment to learn their account.
    const asStored = !input.access_key_id && roleArn === config.role_arn;
    const result = await probe({ auth, roleArn, region, zoneIds, removable: !config.env_key });
    if (
      asStored &&
      result.identity.ok &&
      (config.account_id !== result.identity.account || config.principal_arn !== result.identity.arn)
    ) {
      await db()
        .updateTable('dns_providers')
        .set({
          config: JSON.stringify({
            ...config,
            account_id: result.identity.account,
            principal_arn: result.identity.arn,
          }),
        })
        .where('id', '=', row.id)
        .execute();
    }
    return result;
  }

  return probe({ auth, roleArn, region, zoneIds });
}

/* ------------------------------------------------------------------ CRUD */

function assertEditable(row: DnsProvidersTable, config: AwsProviderConfig): void {
  if (!config.env_key) return;
  throw new ApiError(
    'forbidden',
    `Provider "${row.name}" is declared in the environment ` +
      `(PROVIDER_${row.type.toUpperCase()}_${config.env_key}_*). ` +
      'Change or remove those variables and restart; it cannot be edited from here.',
  );
}

export async function createProvider(
  actor: Principal,
  body: unknown,
  opts: { force?: boolean; req?: Request } = {},
) {
  const parsed = createProviderSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError('validation_error', 'Invalid provider', parsed.error.issues);
  }
  const input = parsed.data;

  const taken = await db()
    .selectFrom('dns_providers')
    .select('id')
    .where('name', '=', input.name)
    .executeTakeFirst();
  if (taken) throw new ApiError('conflict', `A provider named "${input.name}" already exists`);

  if (isRemote(input.type)) {
    const { settings, secrets } = splitFields(input.type, input.settings);
    const result = await probeRemote(input.type, { ...settings, ...secrets });
    if (!result.ok && opts.force !== true) {
      throw new ApiError(
        'forbidden',
        `${PROVIDER_INFO[input.type].label} refused these credentials: ${result.identity.note}. ` +
          'Fix them, or repeat with ?force=true to save anyway.',
        result,
      );
    }
    const now = nowIso();
    const row: DnsProvidersTable = {
      id: randomId('prov'),
      name: input.name,
      type: input.type,
      config: JSON.stringify({ settings, draft: false, env_key: null }),
      secret_enc: encryptSecret(JSON.stringify(secrets)),
      created_by: actor.keyId,
      created_at: now,
      updated_at: now,
    };
    await db().insertInto('dns_providers').values(row).execute();
    await audit(actor.keyId, 'provider.create', {
      target: row.id,
      detail: { name: row.name, type: row.type, probe_ok: result.ok, forced: opts.force === true },
      req: opts.req,
    });
    return { ...view(row, 0), probe: result };
  }

  const auth =
    input.access_key_id && input.secret_access_key
      ? { accessKeyId: input.access_key_id, secretAccessKey: input.secret_access_key }
      : null;
  const result = await probe({
    auth,
    roleArn: input.role_arn ?? null,
    region: input.region,
    zoneIds: [],
  });
  // A draft only needs a working key pair: the role and its rights are what
  // the operator is about to create, guided by what this very call returns.
  const passes = input.draft ? result.identity.ok : result.ok;
  if (!passes && opts.force !== true) {
    throw new ApiError(
      'forbidden',
      input.draft
        ? `The key pair was rejected: ${result.identity.note}`
        : 'The provider credentials did not pass the connection test. ' +
          'Fix them, or repeat with ?force=true to save anyway.',
      result,
    );
  }

  const config: AwsProviderConfig = {
    access_key_id: input.access_key_id ?? null,
    role_arn: input.role_arn ?? null,
    region: input.region,
    account_id: result.identity.account,
    principal_arn: result.identity.arn,
    draft: input.draft,
    env_key: null,
    settings: {},
  };
  const now = nowIso();
  const row: DnsProvidersTable = {
    id: randomId('prov'),
    name: input.name,
    type: 'aws',
    config: JSON.stringify(config),
    secret_enc: input.secret_access_key ? encryptSecret(input.secret_access_key) : null,
    created_by: actor.keyId,
    created_at: now,
    updated_at: now,
  };
  await db().insertInto('dns_providers').values(row).execute();
  await audit(actor.keyId, 'provider.create', {
    target: row.id,
    detail: {
      name: row.name,
      type: row.type,
      draft: input.draft,
      probe_ok: result.ok,
      forced: opts.force === true,
    },
    req: opts.req,
  });
  return { ...view(row, 0), probe: result };
}

export async function updateProvider(
  actor: Principal,
  id: string,
  body: unknown,
  opts: { force?: boolean; req?: Request } = {},
) {
  const parsed = updateProviderSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError('validation_error', 'Invalid provider', parsed.error.issues);
  }
  const input = parsed.data;
  const row = await getProvider(id);
  const config = configOf(row);
  assertEditable(row, config);

  if (input.name && input.name !== row.name) {
    const taken = await db()
      .selectFrom('dns_providers')
      .select('id')
      .where('name', '=', input.name)
      .executeTakeFirst();
    if (taken) throw new ApiError('conflict', `A provider named "${input.name}" already exists`);
  }

  if (isRemote(row.type)) {
    const given = splitFields(row.type, input.settings, true);
    const previous = row.secret_enc
      ? (JSON.parse(decryptSecret(row.secret_enc)) as Record<string, string>)
      : {};
    const settings = { ...config.settings, ...given.settings };
    const secrets = { ...previous, ...given.secrets };
    const result = await probeRemote(row.type, { ...settings, ...secrets });
    const updated: DnsProvidersTable = {
      ...row,
      name: input.name ?? row.name,
      config: JSON.stringify({ settings, draft: false, env_key: null }),
      secret_enc: encryptSecret(JSON.stringify(secrets)),
      updated_at: nowIso(),
    };
    await db()
      .updateTable('dns_providers')
      .set({
        name: updated.name,
        config: updated.config,
        secret_enc: updated.secret_enc,
        updated_at: updated.updated_at,
      })
      .where('id', '=', id)
      .execute();
    await audit(actor.keyId, 'provider.update', {
      target: id,
      detail: {
        name: updated.name,
        fields_changed: Object.keys({ ...given.settings, ...given.secrets }),
        probe_ok: result.ok,
      },
      req: opts.req,
    });
    return { ...view(updated, (await domainCounts()).get(id) ?? 0), probe: result };
  }

  const rotated = Boolean(input.access_key_id && input.secret_access_key);
  const next: AwsProviderConfig = {
    ...config,
    access_key_id: rotated ? input.access_key_id! : config.access_key_id,
    role_arn: input.role_arn === undefined ? config.role_arn : input.role_arn,
    region: input.region ?? config.region,
  };
  const secretEnc = rotated ? encryptSecret(input.secret_access_key!) : row.secret_enc;

  // Refresh the discovered identity; a failing probe is reported, not fatal —
  // an operator must be able to store the new key before the old one is gone.
  const result = await probe({
    auth:
      next.access_key_id && secretEnc
        ? { accessKeyId: next.access_key_id, secretAccessKey: decryptSecret(secretEnc) }
        : null,
    roleArn: next.role_arn,
    region: next.region,
    zoneIds: await zoneIdsOf(id),
  });
  if (result.identity.ok) {
    next.account_id = result.identity.account;
    next.principal_arn = result.identity.arn;
  }
  // Leaving draft is the one update that has to pass: it is what makes the
  // provider selectable for domains.
  if (input.draft === false && config.draft) {
    if (!result.ok && opts.force !== true) {
      throw new ApiError(
        'forbidden',
        'The provider did not pass the connection test. ' +
          'Fix it, or repeat with ?force=true to finalise anyway.',
        result,
      );
    }
    next.draft = false;
  }

  const updated: DnsProvidersTable = {
    ...row,
    name: input.name ?? row.name,
    config: JSON.stringify(next),
    secret_enc: secretEnc,
    updated_at: nowIso(),
  };
  await db()
    .updateTable('dns_providers')
    .set({
      name: updated.name,
      config: updated.config,
      secret_enc: updated.secret_enc,
      updated_at: updated.updated_at,
    })
    .where('id', '=', id)
    .execute();
  await audit(actor.keyId, 'provider.update', {
    target: id,
    detail: {
      name: updated.name,
      key_rotated: rotated,
      finalised: config.draft && !next.draft,
      probe_ok: result.ok,
    },
    req: opts.req,
  });
  return { ...view(updated, (await domainCounts()).get(id) ?? 0), probe: result };
}

/* --------------------------------------------------------------- cleanup */

export interface CleanupStep {
  id: string;
  label: string;
  ok: boolean;
  note: string;
}

export interface CleanupReport {
  /** every step went through */
  ok: boolean;
  /** something was deleted on AWS — the stored credentials may be dead */
  changed: boolean;
  steps: CleanupStep[];
  /** commands for what local-cert could not remove itself */
  leftovers: string[];
}

const lastSegment = (arn: string) => arn.split('/').pop() ?? arn;

/**
 * Removes what the guided setup created on AWS, as far as IAM lets an identity
 * undo itself (see removalStatements): with a role, the role session deletes
 * the IAM user and then its own policy; without one, the user deletes its
 * access key. What remains is inert and listed as commands to run by hand.
 */
async function cleanupAws(row: DnsProvidersTable): Promise<CleanupReport> {
  const config = configOf(row);
  const auth = authOf(row);
  if (!auth) {
    throw new ApiError(
      'validation_error',
      `Provider "${row.name}" uses the credentials of the process: there is no IAM user of its own to remove.`,
    );
  }

  // Deleting an identity another provider relies on would cut that one off too.
  const others = await db().selectFrom('dns_providers').selectAll().where('id', '!=', row.id).execute();
  const sharing = others.filter((o) => {
    if (o.type !== 'aws') return false;
    const c = configOf(o);
    return (
      c.access_key_id === auth.accessKeyId ||
      (config.principal_arn !== null && c.principal_arn === config.principal_arn) ||
      (config.role_arn !== null && c.role_arn === config.role_arn)
    );
  });
  if (sharing.length > 0) {
    throw new ApiError(
      'conflict',
      `Provider "${row.name}" shares its IAM user or role with ${sharing
        .map((o) => `"${o.name}"`)
        .join(', ')}: cleaning up on AWS would cut ${sharing.length > 1 ? 'them' : 'it'} off. ` +
        'Remove it without the AWS clean-up.',
      { shared_with: sharing.map((o) => o.name) },
    );
  }

  const { STSClient, GetCallerIdentityCommand, AssumeRoleCommand } = await import(
    '@aws-sdk/client-sts'
  );
  const iamSdk = await import('@aws-sdk/client-iam');
  const sts = new STSClient({ region: config.region, credentials: auth });

  let userArn: string;
  try {
    userArn = (await sts.send(new GetCallerIdentityCommand({}))).Arn ?? '';
  } catch (err) {
    throw new ApiError('forbidden', `The key pair no longer works: ${explain(err)}`);
  }
  if (!isIamUserArn(userArn)) {
    throw new ApiError(
      'validation_error',
      `The key pair belongs to ${userArn || 'an unknown identity'}, not to an IAM user: nothing to clean up.`,
    );
  }
  const userName = lastSegment(userArn);

  const steps: CleanupStep[] = [];
  let changed = false;
  let failed = false;
  const step = async (id: string, label: string, fn: () => Promise<string>) => {
    if (failed) {
      steps.push({ id, label, ok: false, note: 'skipped — a previous step failed' });
      return;
    }
    try {
      steps.push({ id, label, ok: true, note: await fn() });
    } catch (err) {
      failed = true;
      steps.push({ id, label, ok: false, note: explain(err) });
    }
  };
  const done = (id: string) => steps.some((s) => s.id === id && s.ok);

  if (!config.role_arn) {
    const iam = new iamSdk.IAMClient({ region: 'us-east-1', credentials: auth });
    await step('user_key', `Delete access key ${auth.accessKeyId}`, async () => {
      await iam.send(
        new iamSdk.DeleteAccessKeyCommand({ UserName: userName, AccessKeyId: auth.accessKeyId }),
      );
      changed = true;
      return 'deleted';
    });
    return {
      ok: !failed,
      changed,
      steps,
      leftovers: [
        ...(done('user_key')
          ? []
          : [`aws iam delete-access-key --user-name ${userName} --access-key-id ${auth.accessKeyId}`]),
        `aws iam delete-user-policy --user-name ${userName} --policy-name local-cert-route53`,
        `aws iam delete-user --user-name ${userName}`,
      ],
    };
  }

  const roleName = lastSegment(config.role_arn);
  let iam: InstanceType<typeof iamSdk.IAMClient> | null = null;
  await step('assume', `Assume ${roleName}`, async () => {
    const res = await sts.send(
      new AssumeRoleCommand({
        RoleArn: config.role_arn!,
        RoleSessionName: 'local-cert-cleanup',
        DurationSeconds: 900,
      }),
    );
    const c = res.Credentials;
    if (!c?.AccessKeyId || !c.SecretAccessKey) throw new Error('AssumeRole returned no credentials');
    iam = new iamSdk.IAMClient({
      region: 'us-east-1',
      credentials: {
        accessKeyId: c.AccessKeyId,
        secretAccessKey: c.SecretAccessKey,
        sessionToken: c.SessionToken,
      },
    });
    return 'assumed';
  });
  const client = () => iam as unknown as InstanceType<typeof iamSdk.IAMClient>;

  await step('user_keys', `Delete the access keys of ${userName}`, async () => {
    const res = await client().send(new iamSdk.ListAccessKeysCommand({ UserName: userName }));
    const keys = res.AccessKeyMetadata ?? [];
    for (const key of keys) {
      await client().send(
        new iamSdk.DeleteAccessKeyCommand({ UserName: userName, AccessKeyId: key.AccessKeyId }),
      );
      changed = true;
    }
    return `${keys.length} deleted`;
  });
  await step('user_policies', `Delete the inline policies of ${userName}`, async () => {
    const res = await client().send(new iamSdk.ListUserPoliciesCommand({ UserName: userName }));
    const names = res.PolicyNames ?? [];
    for (const name of names) {
      await client().send(
        new iamSdk.DeleteUserPolicyCommand({ UserName: userName, PolicyName: name }),
      );
      changed = true;
    }
    return `${names.length} deleted`;
  });
  await step('user', `Delete the IAM user ${userName}`, async () => {
    // IAM can take a moment to notice the keys and policies are gone.
    for (let attempt = 1; ; attempt++) {
      try {
        await client().send(new iamSdk.DeleteUserCommand({ UserName: userName }));
        changed = true;
        return 'deleted';
      } catch (err) {
        if ((err as { name?: string }).name !== 'DeleteConflictException' || attempt >= 4) throw err;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  });
  await step('role_policies', `Delete the inline policies of ${roleName}`, async () => {
    const res = await client().send(new iamSdk.ListRolePoliciesCommand({ RoleName: roleName }));
    // The policy that grants this very call goes last.
    const names = [...(res.PolicyNames ?? [])].sort(
      (a, b) => Number(a === 'local-cert-route53') - Number(b === 'local-cert-route53'),
    );
    for (const name of names) {
      await client().send(
        new iamSdk.DeleteRolePolicyCommand({ RoleName: roleName, PolicyName: name }),
      );
      changed = true;
    }
    return `${names.length} deleted`;
  });

  const leftovers: string[] = [];
  if (!done('user')) {
    leftovers.push(
      `aws iam list-access-keys --user-name ${userName}   # then delete-access-key for each`,
      `aws iam list-user-policies --user-name ${userName}   # then delete-user-policy for each`,
      `aws iam delete-user --user-name ${userName}`,
    );
  }
  if (!done('role_policies')) {
    leftovers.push(
      `aws iam delete-role-policy --role-name ${roleName} --policy-name local-cert-route53`,
    );
  }
  leftovers.push(`aws iam delete-role --role-name ${roleName}`);
  return { ok: !failed, changed, steps, leftovers };
}

export async function deleteProvider(
  actor: Principal,
  id: string,
  opts: { cleanup?: boolean; req?: Request } = {},
) {
  const row = await getProvider(id);
  assertEditable(row, configOf(row));
  const domains = await db()
    .selectFrom('domains')
    .select('name')
    .where('provider_id', '=', id)
    .execute();
  if (domains.length > 0) {
    throw new ApiError(
      'conflict',
      `Provider "${row.name}" still serves ${domains.length} domain(s): ` +
        `${domains.map((d) => d.name).join(', ')}. Remove them first.`,
      { domains: domains.map((d) => d.name) },
    );
  }

  let cleanup: CleanupReport | null = null;
  if (opts.cleanup) {
    if (isRemote(row.type)) {
      throw new ApiError(
        'validation_error',
        `The clean-up only exists for AWS; ${PROVIDER_INFO[row.type].label} credentials are revoked at the host.`,
      );
    }
    cleanup = await cleanupAws(row);
    // Nothing was touched: keep the provider, so that the rights can be fixed
    // and the clean-up retried with credentials that still work.
    if (!cleanup.ok && !cleanup.changed) {
      throw new ApiError(
        'forbidden',
        'AWS refused the clean-up and nothing was removed. The pasted policy probably predates ' +
          'the LocalCertRemove* statements: paste the current policy and retry, or remove the ' +
          'provider without the AWS clean-up.',
        cleanup,
      );
    }
  }

  await db().deleteFrom('dns_providers').where('id', '=', id).execute();
  await audit(actor.keyId, 'provider.delete', {
    target: id,
    detail: {
      name: row.name,
      ...(cleanup
        ? {
            aws_cleanup: cleanup.ok ? 'done' : 'partial',
            steps: cleanup.steps.map((s) => `${s.id}:${s.ok ? 'ok' : 'failed'}`),
          }
        : {}),
    },
    req: opts.req,
  });
  return { id, deleted: true, cleanup };
}

/* ----------------------------------------------------------------- zones */

export interface ProviderZone {
  id: string;
  name: string;
  private: boolean;
  record_count: number | null;
  comment: string | null;
  /** managed domains already registered on this zone */
  domains: string[];
  /** false: the public DNS delegates this name to another host; null: not checked */
  delegated: boolean | null;
  /** nameservers the public DNS returns, when delegated is known */
  public_nameservers: string[];
}

export async function listProviderZones(providerId: string): Promise<{ items: ProviderZone[] }> {
  const row = await getProvider(providerId);
  const managed = await db().selectFrom('domains').select(['name', 'route53_zone_id']).execute();
  const domainsOn = (zoneId: string) =>
    managed.filter((d) => d.route53_zone_id === zoneId).map((d) => d.name);

  if (isRemote(row.type)) {
    try {
      const zones = await DRIVERS[row.type].listZones(remoteCfg(row), { delegation: true });
      return {
        items: zones
          .map((z) => ({
            id: z.id,
            name: z.name,
            private: z.private === true,
            record_count: null,
            comment: null,
            domains: domainsOn(z.id),
            delegated: z.delegated ?? null,
            public_nameservers: z.publicNameservers ?? [],
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
    } catch (err) {
      throw new ApiError('upstream_error', `Could not list zones: ${(err as Error).message}`);
    }
  }

  const config = configOf(row);
  // Reuses the same client construction (and role assumption) as real traffic.
  const client = clientFor({
    zoneId: '-',
    region: config.region,
    roleArn: config.role_arn,
    auth: authOf(row),
  });

  const items: ProviderZone[] = [];
  let marker: string | undefined;
  try {
    do {
      const res = await client.send(new ListHostedZonesCommand({ Marker: marker, MaxItems: 100 }));
      for (const z of res.HostedZones ?? []) {
        const id = (z.Id ?? '').replace(/^\/hostedzone\//, '');
        items.push({
          id,
          name: (z.Name ?? '').replace(/\.$/, ''),
          private: z.Config?.PrivateZone === true,
          record_count: z.ResourceRecordSetCount ?? null,
          comment: z.Config?.Comment || null,
          domains: domainsOn(id),
          delegated: null,
          public_nameservers: [],
        });
      }
      marker = res.IsTruncated ? res.NextMarker : undefined;
    } while (marker);
  } catch (err) {
    throw new ApiError('upstream_error', `Could not list hosted zones: ${explain(err)}`);
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  return { items };
}

/* ---------------------------------------------------------------- policy */

/**
 * The full permissions policy for a provider: every zone it already serves
 * plus the ones about to be added. It replaces the previous document rather
 * than patching it, so pasting it can never drop a zone already in use.
 */
export async function providerPolicy(providerId: string, extraZoneIds: string[] = []) {
  const row = await getProvider(providerId);
  const config = configOf(row);
  const zoneIds = [...new Set([...(await zoneIdsOf(providerId)), ...extraZoneIds])].sort();
  // Only AWS scopes rights per zone; elsewhere the credential either reaches
  // the zone or does not, and there is nothing to paste.
  if (isRemote(row.type)) {
    return {
      provider: { id: row.id, name: row.name },
      attach_to: null,
      zone_ids: zoneIds,
      policy: null,
    };
  }
  return {
    provider: { id: row.id, name: row.name },
    /** where the document goes in the AWS console */
    attach_to: config.role_arn
      ? { kind: 'role' as const, arn: config.role_arn }
      : { kind: 'user' as const, arn: config.principal_arn },
    zone_ids: zoneIds,
    policy: permissionsPolicy(
      zoneIds,
      config.env_key ? undefined : { userArn: config.principal_arn, roleArn: config.role_arn },
    ),
  };
}

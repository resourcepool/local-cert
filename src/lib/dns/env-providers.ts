import 'server-only';
import { db, nowIso } from '@/lib/db';
import type { DnsProvidersTable } from '@/lib/db/types';
import { randomId } from '@/lib/crypto/secrets';
import {
  PROVIDER_INFO,
  PROVIDER_TYPES,
  type ProviderType,
  type RemoteProviderType,
} from './provider-types';

/**
 * DNS providers declared in the environment.
 *
 *   PROVIDER_<TYPE>_<KEY>_NAME     required — declares the provider
 *   PROVIDER_<TYPE>_<KEY>_<FIELD>  its credentials
 *
 * <TYPE> is AWS, OVH, GANDI, GODADDY or GCP. <KEY> is any [A-Z0-9_]+ label
 * (DEFAULT, PROD, LAB_EU…); declare as many as needed, or none.
 *
 *   AWS      ACCESS_KEY_ID + SECRET_ACCESS_KEY (optional pair: without it the
 *            process credential chain is used), ROLE_ARN, REGION
 *   others   one variable per field of lib/dns/provider-types.ts, upper-cased:
 *            PROVIDER_GANDI_PERSO_TOKEN, PROVIDER_OVH_MAIN_CONSUMER_KEY, …
 *
 * Each declaration is mirrored into `dns_providers` at boot so domains can
 * reference it, but the environment stays the source of truth: secrets are
 * never copied to the database, and the console can neither edit nor remove
 * the row. Kept apart from lib/dns/providers.ts because boot code must not
 * pull in the auth layer.
 */

export interface EnvProvider {
  type: ProviderType;
  key: string;
  name: string;
  /** AWS */
  accessKeyId: string | null;
  secretAccessKey: string | null;
  roleArn: string | null;
  region: string;
  /** other hosts: every field, secret or not */
  fields: Record<string, string>;
}

const NAME_SUFFIX = '_NAME';
/** the AWS key legacy, provider-less domains are attached to */
const DEFAULT_KEY = 'DEFAULT';
const LEGACY_DEFAULT_SETTING = 'providers.default_aws_id';

const prefix = (type: ProviderType) => `PROVIDER_${type.toUpperCase()}_`;

/** .env loaders strip quotes, a container env_file does not. */
function read(name: string): string | null {
  const raw = process.env[name]?.trim().replace(/^(["'])([\s\S]*)\1$/, '$2').trim();
  return raw || null;
}

/** A JSON document survives an env file badly; base64 is accepted in its place. */
function readField(name: string, multiline: boolean): string | null {
  const raw = read(name);
  if (!raw || !multiline || raw.startsWith('{')) return raw;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    return decoded.trimStart().startsWith('{') ? decoded : raw;
  } catch {
    return raw;
  }
}

function remoteFields(type: RemoteProviderType, key: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of PROVIDER_INFO[type].fields) {
    const value = readField(`${prefix(type)}${key}_${field.key.toUpperCase()}`, field.multiline === true);
    if (value) out[field.key] = value;
  }
  return out;
}

export function declaredProviders(): EnvProvider[] {
  const out: EnvProvider[] = [];
  for (const type of PROVIDER_TYPES) {
    const p = prefix(type);
    for (const variable of Object.keys(process.env).sort()) {
      if (!variable.startsWith(p) || !variable.endsWith(NAME_SUFFIX)) continue;
      const key = variable.slice(p.length, -NAME_SUFFIX.length);
      if (!/^[A-Z0-9_]+$/.test(key)) continue;
      const name = read(variable);
      if (!name) continue;

      if (type === 'aws') {
        const accessKeyId = read(`${p}${key}_ACCESS_KEY_ID`);
        const secretAccessKey = read(`${p}${key}_SECRET_ACCESS_KEY`);
        const paired = Boolean(accessKeyId && secretAccessKey);
        if (!paired && (accessKeyId || secretAccessKey)) {
          console.warn(
            `[providers] ${p}${key}: ACCESS_KEY_ID and SECRET_ACCESS_KEY go together — ` +
              'ignoring the incomplete pair, the process credentials will be used',
          );
        }
        out.push({
          type,
          key,
          name,
          accessKeyId: paired ? accessKeyId : null,
          secretAccessKey: paired ? secretAccessKey : null,
          roleArn: read(`${p}${key}_ROLE_ARN`),
          region: read(`${p}${key}_REGION`) ?? 'us-east-1',
          fields: {},
        });
        continue;
      }

      const fields = remoteFields(type, key);
      const missing = PROVIDER_INFO[type].fields
        .filter((f) => f.required && !fields[f.key])
        .map((f) => `${p}${key}_${f.key.toUpperCase()}`);
      if (missing.length > 0) {
        console.error(
          `[providers] ${variable} is set but ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} missing — declaration ignored`,
        );
        continue;
      }
      out.push({
        type,
        key,
        name,
        accessKeyId: null,
        secretAccessKey: null,
        roleArn: null,
        region: 'us-east-1',
        fields,
      });
    }
  }
  return out;
}

/** Live credentials of an AWS environment provider; null = process credential chain. */
export function envAuth(key: string): { accessKeyId: string; secretAccessKey: string } | null {
  const accessKeyId = read(`${prefix('aws')}${key}_ACCESS_KEY_ID`);
  const secretAccessKey = read(`${prefix('aws')}${key}_SECRET_ACCESS_KEY`);
  return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : null;
}

/** Live settings and secrets of a non-AWS environment provider. */
export function envRemoteConfig(type: RemoteProviderType, key: string): Record<string, string> {
  return remoteFields(type, key);
}

type Config = Record<string, unknown> & { env_key?: string | null };
const configOf = (row: Pick<DnsProvidersTable, 'config'>) => JSON.parse(row.config) as Config;

/** What a declaration stores: everything but the secrets. */
function storedConfig(decl: EnvProvider, previous: Config): string {
  if (decl.type !== 'aws') {
    const settings: Record<string, string> = {};
    for (const field of PROVIDER_INFO[decl.type].fields) {
      if (!field.secret && decl.fields[field.key]) settings[field.key] = decl.fields[field.key];
    }
    return JSON.stringify({ settings, draft: false, env_key: decl.key });
  }
  // the discovered identity only survives while the key is the same
  const sameKey = previous.access_key_id === decl.accessKeyId;
  return JSON.stringify({
    access_key_id: decl.accessKeyId,
    role_arn: decl.roleArn,
    region: decl.region,
    account_id: sameKey ? (previous.account_id ?? null) : null,
    principal_arn: sameKey ? (previous.principal_arn ?? null) : null,
    draft: false,
    env_key: decl.key,
  });
}

/**
 * Mirrors the declarations into the database. Runs at every boot, idempotent.
 */
export async function syncEnvProviders(): Promise<void> {
  const declared = declaredProviders();
  const rows = await db().selectFrom('dns_providers').selectAll().execute();
  // The same label may be used under two types (PROVIDER_AWS_PROD, PROVIDER_OVH_PROD).
  const slot = (type: string, key: string) => `${type}:${key}`;
  const bySlot = new Map(
    rows
      .filter((r) => configOf(r).env_key)
      .map((r) => [slot(r.type, configOf(r).env_key as string), r]),
  );
  const now = nowIso();
  let defaultId: string | null = null;

  for (const decl of declared) {
    const variable = `${prefix(decl.type)}${decl.key}`;
    let row = bySlot.get(slot(decl.type, decl.key)) ?? null;

    // The provider an earlier version created for the process credentials
    // becomes the AWS DEFAULT declaration instead of being duplicated.
    if (!row && decl.type === 'aws' && decl.key === DEFAULT_KEY) {
      const legacy = await db()
        .selectFrom('settings')
        .select('value')
        .where('key', '=', LEGACY_DEFAULT_SETTING)
        .executeTakeFirst();
      row = rows.find((r) => r.id === legacy?.value && !configOf(r).env_key) ?? null;
    }

    const clash = rows.find((r) => r.name === decl.name && r.id !== row?.id);
    if (clash) {
      console.error(
        `[providers] ${variable}_NAME="${decl.name}" is already the name of another ` +
          'provider — rename one of them; this declaration is ignored',
      );
      continue;
    }

    const config = storedConfig(decl, row ? configOf(row) : {});
    let id: string;
    if (row) {
      id = row.id;
      if (row.name !== decl.name || row.config !== config || row.secret_enc !== null) {
        await db()
          .updateTable('dns_providers')
          .set({ name: decl.name, config, secret_enc: null, updated_at: now })
          .where('id', '=', id)
          .execute();
      }
    } else {
      id = randomId('prov');
      const created: DnsProvidersTable = {
        id,
        name: decl.name,
        type: decl.type,
        config,
        secret_enc: null,
        created_by: 'system',
        created_at: now,
        updated_at: now,
      };
      await db().insertInto('dns_providers').values(created).execute();
      rows.push(created);
      console.log(`[providers] "${decl.name}" declared by ${variable}_*`);
    }
    bySlot.delete(slot(decl.type, decl.key));
    if (decl.type === 'aws' && decl.key === DEFAULT_KEY) defaultId = id;
  }

  // A declaration that disappeared hands its row back to the console: it stays
  // (domains reference it) but its credentials went with the variables, so it
  // cannot reach its zones until an operator enters new ones.
  for (const row of bySlot.values()) {
    const { env_key: key, ...rest } = configOf(row);
    const config = { ...rest, access_key_id: null, env_key: null };
    await db()
      .updateTable('dns_providers')
      .set({ config: JSON.stringify(config), updated_at: now })
      .where('id', '=', row.id)
      .execute();
    console.warn(
      `[providers] ${prefix(row.type)}${key}_NAME is gone — "${row.name}" is now managed ` +
        'from the console and needs credentials',
    );
  }

  // Domains registered before providers existed move onto the default AWS one.
  // Those that assumed a role of their own keep their legacy behaviour.
  if (defaultId) {
    const moved = await db()
      .updateTable('domains')
      .set({ provider_id: defaultId })
      .where('provider_id', 'is', null)
      .where('aws_role_arn', 'is', null)
      .executeTakeFirst();
    if (Number(moved.numUpdatedRows) > 0) {
      console.log(`[providers] ${moved.numUpdatedRows} domain(s) attached to the default provider`);
    }
  }
}

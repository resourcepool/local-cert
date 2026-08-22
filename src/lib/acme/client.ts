import 'server-only';
import acme from 'acme-client';
import { db, nowIso } from '@/lib/db';
import { encryptSecret, decryptSecret } from '@/lib/crypto/secrets';
import { isProduction } from '@/lib/env';

const ACCOUNT_KEY_SETTING = 'acme.account_key';
const ACCOUNT_URL_SETTING = 'acme.account_url';

export type AcmeEnv = 'staging' | 'production';

/**
 * Defaults to the real CA in production and staging everywhere else, so a dev
 * instance cannot quietly burn the 50-certificates-per-week limit. ACME_ENV
 * still wins when set explicitly, both ways.
 */
export function acmeEnv(): AcmeEnv {
  const explicit = process.env.ACME_ENV?.toLowerCase();
  if (explicit === 'production' || explicit === 'staging') return explicit;
  return isProduction() ? 'production' : 'staging';
}

export function directoryUrl(): string {
  if (process.env.ACME_DIRECTORY_URL) return process.env.ACME_DIRECTORY_URL;
  return acmeEnv() === 'production'
    ? acme.directory.letsencrypt.production
    : acme.directory.letsencrypt.staging;
}

export function contactEmail(): string {
  const email = process.env.ACME_EMAIL;
  if (!email) throw new Error('ACME_EMAIL is required');
  return email;
}

/**
 * The ACME account key is generated once and reused forever — rotating it
 * orphans the account and its authorizations. Stored AES-GCM encrypted.
 */
async function accountKey(): Promise<Buffer> {
  const row = await db()
    .selectFrom('settings')
    .select('value')
    .where('key', '=', ACCOUNT_KEY_SETTING)
    .executeTakeFirst();
  if (row) return Buffer.from(decryptSecret(row.value), 'utf8');

  const key = await acme.crypto.createPrivateEcdsaKey();
  await db()
    .insertInto('settings')
    .values({
      key: ACCOUNT_KEY_SETTING,
      value: encryptSecret(key.toString()),
      updated_at: nowIso(),
    })
    .execute();
  return key;
}

let cached: { client: acme.Client; directory: string } | null = null;

export async function acmeClient(): Promise<acme.Client> {
  const directory = directoryUrl();
  if (cached && cached.directory === directory) return cached.client;

  const accountUrlRow = await db()
    .selectFrom('settings')
    .select('value')
    .where('key', '=', ACCOUNT_URL_SETTING)
    .executeTakeFirst();

  const client = new acme.Client({
    directoryUrl: directory,
    accountKey: await accountKey(),
    accountUrl: accountUrlRow?.value,
    backoffAttempts: 5,
    backoffMin: 5000,
    backoffMax: 30000,
  });

  if (!accountUrlRow) {
    await client.createAccount({
      termsOfServiceAgreed: true,
      contact: [`mailto:${contactEmail()}`],
    });
    const url = client.getAccountUrl();
    await db()
      .insertInto('settings')
      .values({ key: ACCOUNT_URL_SETTING, value: url, updated_at: nowIso() })
      .execute();
  }

  cached = { client, directory };
  return client;
}

export async function accountStatus() {
  const client = await acmeClient();
  let accountUrl: string | null = null;
  try {
    accountUrl = client.getAccountUrl();
  } catch {
    accountUrl = null;
  }
  return {
    environment: acmeEnv(),
    directory_url: directoryUrl(),
    contact: contactEmail(),
    account_url: accountUrl,
  };
}

export { acme };

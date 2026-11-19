import 'server-only';
import { db, nowIso } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';
import { syncEnvProviders } from '@/lib/dns/env-providers';
import { mintKey, adoptKey, type MintedKey } from './apikey';
import { hashPassword } from '@/lib/crypto/password';
import { validatePassword } from '@/lib/env';
import { randomId } from '@/lib/crypto/secrets';
import { ApiError } from '@/lib/http';
import { SCOPES } from '@/lib/scopes';

const SETUP_FLAG = 'setup.completed_at';

let ready: Promise<void> | null = null;

/**
 * Runs migrations, then applies the environment-provided admin account when one
 * is configured. Idempotent, and awaited by every request path.
 */
export async function ensureReady(): Promise<void> {
  if (!ready) ready = init();
  return ready;
}

async function init(): Promise<void> {
  await migrate();
  await syncEnvProviders();
  if (await isSetupComplete()) return;

  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('[setup] no admin account yet — the console will ask for one at /setup');
    return;
  }

  const key = await completeSetup({
    email,
    password,
    apiKeyToken: process.env.ADMIN_API_KEY?.trim() || undefined,
    source: 'env',
  });

  console.log(
    `[setup] admin account "${email}" created from environment variables` +
      (process.env.ADMIN_API_KEY ? ' (using ADMIN_API_KEY)' : `; API key: ${key.token}`),
  );
}

export async function isSetupComplete(): Promise<boolean> {
  const flag = await db()
    .selectFrom('settings')
    .select('value')
    .where('key', '=', SETUP_FLAG)
    .executeTakeFirst();
  return Boolean(flag);
}

export interface SetupInput {
  email: string;
  password: string;
  /** operator-chosen token; one is minted when absent */
  apiKeyToken?: string;
  source: 'env' | 'wizard';
}

export interface SetupResult {
  userId: string;
  keyId: string;
  /** returned once — never retrievable afterwards */
  token: string;
  minted: boolean;
}

/**
 * Creates the admin account and its API key in one transaction, then latches
 * the setup flag. The flag insert is what makes this single-shot: a second
 * caller racing the first fails on the settings primary key and rolls back.
 */
export async function completeSetup(input: SetupInput): Promise<SetupResult> {
  const violations = validatePassword(input.password, input.email);
  if (violations.length > 0) {
    throw new ApiError('validation_error', violations[0], { violations });
  }

  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const key: MintedKey = input.apiKeyToken ? adoptKey(input.apiKeyToken) : mintKey();
  const userId = randomId('usr');
  const now = nowIso();

  try {
    await db()
      .transaction()
      .execute(async (trx) => {
        await trx
          .insertInto('settings')
          .values({ key: SETUP_FLAG, value: now, updated_at: now })
          .execute();

        await trx
          .insertInto('users')
          .values({
            id: userId,
            email,
            password_hash: passwordHash,
            is_admin: 1,
            created_at: now,
            last_login_at: null,
            disabled_at: null,
          })
          .execute();

        await trx
          .insertInto('api_keys')
          .values({
            id: key.id,
            name: `${email} (admin)`,
            user_id: userId,
            secret_hash: key.secretHash,
            prefix: key.prefix,
            opaque: key.opaque ? 1 : 0,
            is_admin: 1,
            global_scopes: JSON.stringify([SCOPES.ADMIN]),
            created_at: now,
            expires_at: null,
            last_used_at: null,
            revoked_at: null,
          })
          .execute();
      });
  } catch (err) {
    if (await isSetupComplete()) {
      throw new ApiError('conflict', 'Setup has already been completed');
    }
    throw err;
  }

  return { userId, keyId: key.id, token: key.token, minted: !input.apiKeyToken };
}

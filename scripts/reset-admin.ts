/**
 * Emergency access: resets the admin account's password and mints a fresh API
 * key. Existing keys for that account are revoked, not deleted, so the audit
 * trail stays intact.
 *
 *   npx tsx scripts/reset-admin.ts <email> <new-password>
 */
import { db, nowIso } from '../src/lib/db';
import { migrate } from '../src/lib/db/migrate';
import { mintKey } from '../src/lib/auth/apikey';
import { hashPassword } from '../src/lib/crypto/password';
import { SCOPES } from '../src/lib/scopes';
import { validatePassword, appEnv } from '../src/lib/env';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('usage: npx tsx scripts/reset-admin.ts <email> <new-password>');
  process.exit(1);
}
const violations = validatePassword(password, email);
if (violations.length > 0) {
  console.error(`password rejected (${appEnv()} policy):`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

await migrate();

const user = await db()
  .selectFrom('users')
  .selectAll()
  .where('email', '=', email.trim().toLowerCase())
  .executeTakeFirst();

if (!user) {
  const known = await db().selectFrom('users').select('email').execute();
  console.error(
    `no account for "${email}". Known accounts: ${known.map((u) => u.email).join(', ') || '(none)'}`,
  );
  process.exit(1);
}

await db()
  .updateTable('users')
  .set({ password_hash: await hashPassword(password), disabled_at: null })
  .where('id', '=', user.id)
  .execute();

await db()
  .updateTable('api_keys')
  .set({ revoked_at: nowIso() })
  .where('user_id', '=', user.id)
  .where('revoked_at', 'is', null)
  .execute();

const key = mintKey();
await db()
  .insertInto('api_keys')
  .values({
    id: key.id,
    name: `${user.email} (admin)`,
    user_id: user.id,
    secret_hash: key.secretHash,
    prefix: key.prefix,
    opaque: 0,
    is_admin: 1,
    global_scopes: JSON.stringify([SCOPES.ADMIN]),
    created_at: nowIso(),
    expires_at: null,
    last_used_at: null,
    revoked_at: null,
  })
  .execute();

console.log(`\npassword reset for ${user.email}`);
console.log(`new API key (shown once):\n\n  ${key.token}\n`);
process.exit(0);

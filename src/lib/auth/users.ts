import 'server-only';
import { db, nowIso } from '@/lib/db';
import { verifyPassword, fakeVerify } from '@/lib/crypto/password';

export interface AuthenticatedUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

/**
 * Constant-ish work regardless of whether the account exists, so a wrong email
 * and a wrong password cannot be told apart by timing.
 */
export async function authenticateUser(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const user = await db()
    .selectFrom('users')
    .selectAll()
    .where('email', '=', email.trim().toLowerCase())
    .executeTakeFirst();

  if (!user || user.disabled_at) {
    await fakeVerify();
    return null;
  }
  if (!(await verifyPassword(user.password_hash, password))) return null;

  await db()
    .updateTable('users')
    .set({ last_login_at: nowIso() })
    .where('id', '=', user.id)
    .execute();

  return { id: user.id, email: user.email, isAdmin: user.is_admin === 1 };
}

import { cookies } from 'next/headers';
import { signAccessToken } from '@/lib/auth/jwt';
import { ensureReady, isSetupComplete } from '@/lib/auth/setup';
import { authenticateUser } from '@/lib/auth/users';
import { SESSION_COOKIE, getAdminSession, audit } from '@/lib/auth/guard';
import { handler, ok, problem } from '@/lib/http';
import { loginSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

import { SCOPES } from '@/lib/scopes';

const SCOPES_ADMIN = SCOPES.ADMIN;
const SESSION_TTL = Number(process.env.SESSION_TTL_SECONDS ?? 8 * 3600);

/** POST — sign in to the admin console with the admin account's credentials. */
export const POST = handler(async (req: Request) => {
  await ensureReady();
  if (!(await isSetupComplete())) {
    return problem('conflict', 'Setup has not been completed yet');
  }

  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return problem('validation_error', 'Email and password required');

  const user = await authenticateUser(parsed.data.email, parsed.data.password);
  if (!user) return problem('unauthorized', 'Invalid email or password');
  if (!user.isAdmin) return problem('forbidden', 'This account is not an administrator');

  const { token, expiresAt } = await signAccessToken(
    { sub: user.id, name: user.email, adm: true, knd: 'user', gsc: [SCOPES_ADMIN], dsc: {} },
    SESSION_TTL,
  );

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  await audit(user.id, 'admin.login', { req });
  return ok({ email: user.email, expires_at: expiresAt.toISOString() });
});

/** GET — whoami for the console shell. */
export const GET = handler(async () => {
  const session = await getAdminSession();
  if (!session) return problem('unauthorized', 'Not signed in');
  return ok({ id: session.keyId, name: session.name, kind: session.kind, is_admin: true });
});

/** DELETE — sign out. */
export const DELETE = handler(async () => {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return ok({ signed_out: true });
});

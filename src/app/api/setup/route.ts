import { cookies } from 'next/headers';
import { handler, ok, problem } from '@/lib/http';
import { ensureReady, isSetupComplete, completeSetup } from '@/lib/auth/setup';
import { signAccessToken } from '@/lib/auth/jwt';
import { SESSION_COOKIE, audit } from '@/lib/auth/guard';
import { setupSchema } from '@/lib/validation';
import { SCOPES } from '@/lib/scopes';
import { appEnv, passwordPolicy, describePolicy } from '@/lib/env';

export const dynamic = 'force-dynamic';

const SESSION_TTL = Number(process.env.SESSION_TTL_SECONDS ?? 8 * 3600);

/** GET — lets the UI decide between /setup and /login. */
export const GET = handler(async () => {
  await ensureReady();
  return ok({
    setup_required: !(await isSetupComplete()),
    environment: appEnv(),
    password_policy: { ...passwordPolicy(), description: describePolicy() },
  });
});

/**
 * POST — one-shot creation of the admin account. Unauthenticated by necessity,
 * and permanently closed afterwards by the setup flag.
 */
export const POST = handler(async (req: Request) => {
  await ensureReady();
  if (await isSetupComplete()) {
    return problem('conflict', 'Setup has already been completed');
  }

  const parsed = setupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return problem('validation_error', 'Invalid setup payload', parsed.error.issues);
  }

  const result = await completeSetup({
    email: parsed.data.email,
    password: parsed.data.password,
    apiKeyToken: parsed.data.api_key,
    source: 'wizard',
  });

  // Sign the new admin straight in — asking them to retype credentials they
  // just chose adds nothing.
  const { token, expiresAt } = await signAccessToken(
    {
      sub: result.userId,
      name: parsed.data.email,
      adm: true,
      knd: 'user',
      gsc: [SCOPES.ADMIN],
      dsc: {},
    },
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

  await audit(result.userId, 'setup.complete', { detail: { email: parsed.data.email }, req });

  return ok(
    {
      email: parsed.data.email,
      // shown once, here and nowhere else
      api_key: result.token,
      api_key_minted: result.minted,
    },
    { status: 201, headers: { 'cache-control': 'no-store' } },
  );
});

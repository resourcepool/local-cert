import { resolveApiKey } from '@/lib/auth/apikey';
import { signAccessToken, ACCESS_TTL_SECONDS } from '@/lib/auth/jwt';
import { ensureReady } from '@/lib/auth/setup';
import { audit } from '@/lib/auth/guard';
import { handler, ok, problem } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/token
 * Exchange a long-lived API key for a short-lived JWT carrying its scopes.
 * Body: { "api_key": "lc_..." }  — or Authorization: Bearer lc_...
 */
export const POST = handler(async (req: Request) => {
  await ensureReady();

  let apiKey: string | undefined;
  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) apiKey = auth.slice(7).trim();
  if (!apiKey) {
    const body = await req.json().catch(() => ({}));
    apiKey = typeof body?.api_key === 'string' ? body.api_key : undefined;
  }
  if (!apiKey) return problem('validation_error', 'Provide an API key');

  const key = await resolveApiKey(apiKey);
  if (!key) return problem('unauthorized', 'Invalid, revoked or expired API key');

  const { token, expiresAt } = await signAccessToken({
    sub: key.id,
    name: key.name,
    adm: key.isAdmin,
    knd: 'key',
    gsc: key.globalScopes,
    dsc: key.grants,
  });

  await audit(key.id, 'auth.token', { req });

  return ok({
    access_token: token,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_SECONDS,
    expires_at: expiresAt.toISOString(),
    scope: [...key.globalScopes].join(' '),
  });
});

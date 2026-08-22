import 'server-only';
import { cookies } from 'next/headers';
import { db, nowIso } from '@/lib/db';
import { ensureReady, isSetupComplete } from './setup';
import { verifyAccessToken } from './jwt';
import { resolveApiKey } from './apikey';
import { randomId } from '@/lib/crypto/secrets';
import { ApiError, clientIp } from '@/lib/http';
import { SCOPES, hasScope, type Scope } from '@/lib/scopes';

export const SESSION_COOKIE = 'lc_session';

export interface Principal {
  /** api key id, or user id for a console session */
  keyId: string;
  name: string;
  kind: 'key' | 'user';
  isAdmin: boolean;
  globalScopes: Scope[];
  domainScopes: Record<string, Scope[]>;
}

/**
 * Accepts either:
 *   Authorization: Bearer <jwt>        (issued by POST /api/v1/auth/token)
 *   Authorization: Bearer lc_<p>_<s>   (raw API key — convenience for curl/cron)
 */
export async function authenticate(req: Request): Promise<Principal | null> {
  await ensureReady();
  const header = req.headers.get('authorization');
  let token: string | undefined;
  if (header?.toLowerCase().startsWith('bearer ')) {
    token = header.slice(7).trim();
  } else {
    // Console fallback: the admin UI calls /api/v1 with its session cookie.
    // SameSite=lax means the cookie is never attached to a cross-site POST,
    // so this does not open a CSRF hole on the mutating endpoints.
    token = (await cookies()).get(SESSION_COOKIE)?.value;
  }
  if (!token) return null;

  // A JWT is exactly three dot-separated segments. Anything else — a minted
  // lc_ key or an operator-supplied opaque ADMIN_API_KEY — is an API key, and a
  // token that merely looks like a JWT still falls through to the key lookup.
  if (token.split('.').length === 3) {
    const claims = await verifyAccessToken(token);
    if (claims) {
      return {
        keyId: claims.sub,
        name: claims.name,
        kind: claims.knd ?? 'key',
        isAdmin: claims.adm,
        globalScopes: claims.gsc ?? [],
        domainScopes: claims.dsc ?? {},
      };
    }
  }

  const key = await resolveApiKey(token);
  if (!key) return null;
  return {
    keyId: key.id,
    name: key.name,
    kind: 'key',
    isAdmin: key.isAdmin,
    globalScopes: key.globalScopes,
    domainScopes: key.grants,
  };
}

export async function requireAuth(req: Request): Promise<Principal> {
  if (!(await isSetupComplete())) {
    throw new ApiError('setup_required', 'The instance has not been set up yet');
  }
  const p = await authenticate(req);
  if (!p) throw new ApiError('unauthorized', 'Missing or invalid credentials');
  return p;
}

/** Admin console: JWT stored in an httpOnly cookie rather than Authorization. */
export async function requireAdminSession(): Promise<Principal> {
  await ensureReady();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) throw new ApiError('unauthorized', 'Not signed in');
  const claims = await verifyAccessToken(token);
  if (!claims?.adm) throw new ApiError('forbidden', 'Admin privileges required');
  return {
    keyId: claims.sub,
    name: claims.name,
    kind: claims.knd ?? 'user',
    isAdmin: true,
    globalScopes: claims.gsc ?? [],
    domainScopes: claims.dsc ?? {},
  };
}

export async function getAdminSession(): Promise<Principal | null> {
  try {
    return await requireAdminSession();
  } catch {
    return null;
  }
}

export function requireAdmin(p: Principal): void {
  if (!p.isAdmin && !p.globalScopes.includes(SCOPES.ADMIN)) {
    throw new ApiError('forbidden', 'Admin privileges required');
  }
}

/** Effective scopes on a domain = global scopes ∪ grant scopes (admin = all). */
export function scopesOn(p: Principal, domainId: string): Scope[] {
  if (p.isAdmin) return [SCOPES.ADMIN];
  return [...new Set([...p.globalScopes, ...(p.domainScopes[domainId] ?? [])])];
}

export function requireScope(p: Principal, domainId: string, scope: Scope): void {
  if (!hasScope(scopesOn(p, domainId), scope)) {
    throw new ApiError('forbidden', `Scope "${scope}" required on this domain`);
  }
}

/** Domain ids this principal can see at all. */
export function visibleDomainIds(p: Principal): string[] | 'all' {
  if (p.isAdmin || p.globalScopes.includes(SCOPES.ADMIN)) return 'all';
  return Object.keys(p.domainScopes);
}

export async function audit(
  actor: string,
  action: string,
  opts: { target?: string; detail?: unknown; req?: Request } = {},
): Promise<void> {
  await db()
    .insertInto('audit_log')
    .values({
      id: randomId('aud'),
      at: nowIso(),
      actor,
      action,
      target: opts.target ?? null,
      detail: opts.detail ? JSON.stringify(opts.detail) : null,
      ip: opts.req ? clientIp(opts.req) : null,
    })
    .execute();
}

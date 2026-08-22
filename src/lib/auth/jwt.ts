import 'server-only';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { Scope } from '@/lib/scopes';

const ISSUER = 'local-cert';
const AUDIENCE = 'local-cert-api';

let cachedSecret: Uint8Array | null = null;

function secret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error('JWT_SECRET is required (>= 32 chars). Generate: openssl rand -base64 48');
  }
  cachedSecret = new TextEncoder().encode(raw);
  return cachedSecret;
}

export interface AccessClaims extends JWTPayload {
  /** api key id, or user id for a console session */
  sub: string;
  name: string;
  adm: boolean;
  /** "key" for API access, "user" for a console session */
  knd: 'key' | 'user';
  /** global scopes */
  gsc: Scope[];
  /** per-domain scopes: domain_id -> scopes */
  dsc: Record<string, Scope[]>;
}

/** Input side of the claim set — kept free of JWTPayload's index signature. */
export interface AccessClaimsInput {
  sub: string;
  name: string;
  adm: boolean;
  knd: 'key' | 'user';
  gsc: Scope[];
  dsc: Record<string, Scope[]>;
}

export const ACCESS_TTL_SECONDS = Number(process.env.JWT_TTL_SECONDS ?? 3600);

export async function signAccessToken(
  claims: AccessClaimsInput,
  ttlSeconds = ACCESS_TTL_SECONDS,
): Promise<{ token: string; expiresAt: Date }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setSubject(claims.sub)
    .sign(secret());
  return { token, expiresAt: new Date(exp * 1000) };
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    return payload as AccessClaims;
  } catch {
    return null;
  }
}

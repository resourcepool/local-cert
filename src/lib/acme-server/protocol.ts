import 'server-only';
import { randomBytes } from 'node:crypto';
import { calculateJwkThumbprint, flattenedVerify, importJWK, type JWK } from 'jose';
import { db, nowIso } from '@/lib/db';
import type { AcmeAccountsTable } from '@/lib/db/types';

/**
 * Wire-level half of the RFC 8555 server: problem documents, URLs, nonces and
 * JWS authentication. Nothing in here knows about orders or certificates.
 */

export type AcmeErrorType =
  | 'accountDoesNotExist'
  | 'alreadyRevoked'
  | 'badCSR'
  | 'badNonce'
  | 'badPublicKey'
  | 'badSignatureAlgorithm'
  | 'externalAccountRequired'
  | 'malformed'
  | 'orderNotReady'
  | 'rejectedIdentifier'
  | 'serverInternal'
  | 'unauthorized'
  | 'unsupportedIdentifier';

const STATUS: Record<AcmeErrorType, number> = {
  accountDoesNotExist: 400,
  alreadyRevoked: 400,
  badCSR: 400,
  badNonce: 400,
  badPublicKey: 400,
  badSignatureAlgorithm: 400,
  externalAccountRequired: 403,
  malformed: 400,
  orderNotReady: 403,
  rejectedIdentifier: 400,
  serverInternal: 500,
  unauthorized: 403,
  unsupportedIdentifier: 400,
};

export class AcmeError extends Error {
  readonly status: number;
  constructor(
    readonly type: AcmeErrorType,
    message: string,
    status?: number,
  ) {
    super(message);
    this.status = status ?? STATUS[type];
  }
}

export interface AcmeProblem {
  type: string;
  detail: string;
  status?: number;
}

export function problemDocument(type: AcmeErrorType, detail: string, status?: number): AcmeProblem {
  return { type: `urn:ietf:params:acme:error:${type}`, detail, ...(status ? { status } : {}) };
}

export function problemResponse(err: AcmeError): Response {
  return new Response(JSON.stringify(problemDocument(err.type, err.message, err.status)), {
    status: err.status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/* --------------------------------------------------------------------- urls */

/**
 * Origin the ACME client reaches us on. Clients sign the exact request URL, so
 * behind a reverse proxy this must match what they typed: set PUBLIC_URL, or
 * make the proxy forward X-Forwarded-Proto / X-Forwarded-Host.
 */
export function baseUrl(req: Request): string {
  const fixed = process.env.PUBLIC_URL?.trim();
  if (fixed) return fixed.replace(/\/+$/, '');
  const url = new URL(req.url);
  const first = (name: string) => req.headers.get(name)?.split(',')[0].trim() || null;
  const proto = first('x-forwarded-proto') ?? url.protocol.replace(':', '');
  const host = first('x-forwarded-host') ?? req.headers.get('host') ?? url.host;
  return `${proto}://${host}`;
}

export function urls(req: Request) {
  const root = `${baseUrl(req)}/acme`;
  return {
    directory: `${root}/directory`,
    newNonce: `${root}/new-nonce`,
    newAccount: `${root}/new-account`,
    newOrder: `${root}/new-order`,
    revokeCert: `${root}/revoke-cert`,
    account: (id: string) => `${root}/acct/${id}`,
    accountOrders: (id: string) => `${root}/acct/${id}/orders`,
    order: (id: string) => `${root}/order/${id}`,
    finalize: (id: string) => `${root}/order/${id}/finalize`,
    authz: (id: string) => `${root}/authz/${id}`,
    challenge: (authzId: string, type: string) => `${root}/chall/${authzId}/${type}`,
    certificate: (orderId: string) => `${root}/cert/${orderId}`,
  };
}

export type Urls = ReturnType<typeof urls>;

/* ------------------------------------------------------------------- nonces */

const NONCE_TTL_MS = 3600_000;

export async function newNonce(): Promise<string> {
  const nonce = randomBytes(16).toString('base64url');
  await db()
    .insertInto('acme_nonces')
    .values({ nonce, expires_at: new Date(Date.now() + NONCE_TTL_MS).toISOString() })
    .execute();
  // Opportunistic purge: unused nonces are the common case (every response carries one).
  if (Math.random() < 0.02) {
    await db().deleteFrom('acme_nonces').where('expires_at', '<', nowIso()).execute();
  }
  return nonce;
}

/** Single use: the DELETE is the check, so two racing requests cannot both win. */
async function consumeNonce(nonce: string): Promise<boolean> {
  const res = await db()
    .deleteFrom('acme_nonces')
    .where('nonce', '=', nonce)
    .where('expires_at', '>', nowIso())
    .executeTakeFirst();
  return Number(res.numDeletedRows ?? 0) > 0;
}

/* ---------------------------------------------------------------------- jws */

const ALGS = ['ES256', 'ES384', 'ES512', 'RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'EdDSA'];
const PUBLIC_JWK_FIELDS = ['kty', 'crv', 'x', 'y', 'n', 'e'] as const;

export interface FlattenedJws {
  protected: string;
  payload: string;
  signature: string;
}

export function isFlattenedJws(v: unknown): v is FlattenedJws {
  const o = v as Record<string, unknown> | null;
  return (
    !!o &&
    typeof o === 'object' &&
    typeof o.protected === 'string' &&
    typeof o.payload === 'string' &&
    typeof o.signature === 'string'
  );
}

export function decodeJson(b64url: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(Buffer.from(b64url, 'base64url').toString('utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  throw new AcmeError('malformed', 'JWS part is not base64url-encoded JSON');
}

/** Keeps only public members, so a client that leaks `d` never gets it stored. */
export function publicJwk(raw: unknown): JWK {
  if (!raw || typeof raw !== 'object') throw new AcmeError('badPublicKey', 'jwk must be an object');
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const f of PUBLIC_JWK_FIELDS) {
    if (typeof src[f] === 'string') out[f] = src[f] as string;
  }
  if (!out.kty) throw new AcmeError('badPublicKey', 'jwk.kty is missing');
  return out as JWK;
}

export async function thumbprint(jwk: JWK): Promise<string> {
  try {
    return await calculateJwkThumbprint(jwk, 'sha256');
  } catch {
    throw new AcmeError('badPublicKey', 'Unsupported or incomplete account key');
  }
}

export interface VerifiedRequest {
  /** parsed payload; null for POST-as-GET (empty payload) */
  payload: Record<string, unknown> | null;
  /** set when the request was signed with `kid` */
  account: AcmeAccountsTable | null;
  jwk: JWK;
  thumbprint: string;
}

/**
 * Authenticates an ACME POST (RFC 8555 §6.2): signature, anti-replay nonce and
 * the `url` binding. `keyMode` says which key reference the endpoint accepts —
 * `jwk` for newAccount, `kid` for everything tied to an existing account.
 */
export async function verifyRequest(req: Request, keyMode: 'jwk' | 'kid'): Promise<VerifiedRequest> {
  const body = await req.json().catch(() => null);
  if (!isFlattenedJws(body)) {
    throw new AcmeError('malformed', 'Request body must be a flattened JWS (protected, payload, signature)');
  }

  const header = decodeJson(body.protected);
  const alg = header.alg;
  if (typeof alg !== 'string' || !ALGS.includes(alg)) {
    throw new AcmeError('badSignatureAlgorithm', `Unsupported JWS alg; use one of ${ALGS.join(', ')}`);
  }

  const expectedUrl = `${baseUrl(req)}${new URL(req.url).pathname}`;
  if (header.url !== expectedUrl) {
    throw new AcmeError(
      'unauthorized',
      `JWS "url" is ${JSON.stringify(header.url)} but this endpoint is "${expectedUrl}" (check PUBLIC_URL / proxy headers)`,
    );
  }

  const hasJwk = header.jwk !== undefined;
  const hasKid = header.kid !== undefined;
  if (hasJwk === hasKid) throw new AcmeError('malformed', 'JWS must carry exactly one of "jwk" and "kid"');
  if (keyMode === 'jwk' && !hasJwk) throw new AcmeError('malformed', 'This endpoint requires a "jwk" header');
  if (keyMode === 'kid' && !hasKid) throw new AcmeError('malformed', 'This endpoint requires a "kid" header');

  let account: AcmeAccountsTable | null = null;
  let jwk: JWK;
  if (hasKid) {
    const prefix = `${baseUrl(req)}/acme/acct/`;
    const kid = typeof header.kid === 'string' ? header.kid : '';
    const row = kid.startsWith(prefix)
      ? await db()
          .selectFrom('acme_accounts')
          .selectAll()
          .where('id', '=', kid.slice(prefix.length))
          .executeTakeFirst()
      : undefined;
    if (!row) throw new AcmeError('accountDoesNotExist', 'Unknown account');
    if (row.status !== 'valid') throw new AcmeError('unauthorized', 'Account is deactivated');
    account = row;
    jwk = JSON.parse(row.jwk) as JWK;
  } else {
    jwk = publicJwk(header.jwk);
  }

  let payloadBytes: Uint8Array;
  try {
    const key = await importJWK(jwk, alg);
    ({ payload: payloadBytes } = await flattenedVerify(body, key, { algorithms: ALGS }));
  } catch {
    throw new AcmeError('malformed', 'JWS signature verification failed');
  }

  // After the signature, so an unauthenticated caller cannot burn other clients' nonces.
  if (typeof header.nonce !== 'string' || !(await consumeNonce(header.nonce))) {
    throw new AcmeError('badNonce', 'Missing, unknown or already used nonce');
  }

  let payload: Record<string, unknown> | null = null;
  if (payloadBytes.length > 0) {
    try {
      const parsed = JSON.parse(Buffer.from(payloadBytes).toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      payload = parsed;
    } catch {
      throw new AcmeError('malformed', 'JWS payload must be a JSON object or empty');
    }
  }

  return { payload, account, jwk, thumbprint: await thumbprint(jwk) };
}

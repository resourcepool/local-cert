import 'server-only';
import { X509Certificate, randomBytes } from 'node:crypto';
import { flattenedVerify } from 'jose';
import { db, nowIso } from '@/lib/db';
import type {
  AcmeAccountsTable,
  AcmeAuthorizationsTable,
  AcmeEabKeysTable,
  AcmeOrdersTable,
} from '@/lib/db/types';
import { randomId, decryptSecret } from '@/lib/crypto/secrets';
import { audit } from '@/lib/auth/guard';
import { belongsToDomain, fqdnSchema } from '@/lib/validation';
import { createCertificate, listDomains } from '@/lib/certificates';
import { acme } from '@/lib/acme/client';
import {
  finalizeExternalOrder,
  logEvent,
  revoke,
  validateExternalOrder,
} from '@/lib/acme/issue';
import { eabDomainIds, eabUsable } from './eab';
import {
  AcmeError,
  decodeJson,
  isFlattenedJws,
  json,
  problemDocument,
  publicJwk,
  thumbprint,
  urls,
  verifyRequest,
  type AcmeProblem,
  type Urls,
} from './protocol';

/**
 * RFC 8555 resources on top of the existing issuance pipeline.
 *
 * Who may order what is decided by the EAB credential the account registered
 * with — its domain list, expiry and revocation are re-read on every request —
 * not by the challenge. Only names under one of its managed domains pass.
 *
 * The client sees a plain http-01 challenge, but nobody fetches
 * /.well-known/acme-challenge: these are LAN hosts this server usually cannot
 * reach. Answering the challenge is the trigger for what local-cert always
 * did — write the TXT record in Route53 and validate with the upstream CA
 * over DNS-01 — and the challenge turns valid when that is done.
 */

const ORDER_TTL_MS = 3600_000;
const CHALLENGE_TYPES = ['http-01'];
/** How long finalize holds the request before answering "processing". */
const FINALIZE_WAIT_MS = 8_000;
const RETRY_AFTER = { 'retry-after': '3' };

/* ----------------------------------------------------------------- helpers */

interface Session {
  account: AcmeAccountsTable;
  credential: AcmeEabKeysTable;
  payload: Record<string, unknown> | null;
}

/** kid-authenticated request whose EAB credential is still alive. */
async function session(req: Request): Promise<Session> {
  const v = await verifyRequest(req, 'kid');
  const account = v.account!;
  const credential = await db()
    .selectFrom('acme_eab_keys')
    .selectAll()
    .where('id', '=', account.eab_id)
    .executeTakeFirst();
  if (!credential || !eabUsable(credential)) {
    throw new AcmeError('unauthorized', 'The EAB credential this account registered with is revoked or expired');
  }
  return { account, credential, payload: v.payload };
}

function accountView(account: AcmeAccountsTable, u: Urls) {
  return {
    status: account.status,
    contact: JSON.parse(account.contact) as string[],
    orders: u.accountOrders(account.id),
  };
}

function parseContact(raw: unknown): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 10 || raw.some((c) => typeof c !== 'string' || c.length > 320)) {
    throw new AcmeError('malformed', '"contact" must be an array of at most 10 URIs');
  }
  return raw as string[];
}

/* --------------------------------------------------------------- directory */

export function directory(req: Request): Response {
  const u = urls(req);
  return json({
    newNonce: u.newNonce,
    newAccount: u.newAccount,
    newOrder: u.newOrder,
    revokeCert: u.revokeCert,
    meta: { externalAccountRequired: true },
  });
}

/* ---------------------------------------------------------------- accounts */

export async function newAccount(req: Request): Promise<Response> {
  const u = urls(req);
  const v = await verifyRequest(req, 'jwk');
  const payload = v.payload ?? {};

  const existing = await db()
    .selectFrom('acme_accounts')
    .selectAll()
    .where('thumbprint', '=', v.thumbprint)
    .executeTakeFirst();
  if (existing) {
    if (existing.status !== 'valid') throw new AcmeError('unauthorized', 'Account is deactivated');
    return json(accountView(existing, u), 200, { location: u.account(existing.id) });
  }
  if (payload.onlyReturnExisting === true) {
    throw new AcmeError('accountDoesNotExist', 'No account exists for this key');
  }

  const eab = payload.externalAccountBinding;
  if (eab === undefined) {
    throw new AcmeError(
      'externalAccountRequired',
      'Registration needs an External Account Binding; create a credential in the local-cert console',
    );
  }
  if (!isFlattenedJws(eab)) throw new AcmeError('malformed', 'externalAccountBinding must be a flattened JWS');

  const eabHeader = decodeJson(eab.protected);
  if (eabHeader.url !== u.newAccount) {
    throw new AcmeError('malformed', 'externalAccountBinding "url" must be the newAccount URL');
  }
  const kid = typeof eabHeader.kid === 'string' ? eabHeader.kid : '';
  const credential = await db()
    .selectFrom('acme_eab_keys')
    .selectAll()
    .where('id', '=', kid)
    .executeTakeFirst();
  if (!credential || !eabUsable(credential)) {
    throw new AcmeError('unauthorized', 'Unknown, revoked or expired External Account Binding key id');
  }

  let boundJwk: unknown;
  try {
    const mac = Buffer.from(decryptSecret(credential.hmac_enc), 'base64url');
    const { payload: bytes } = await flattenedVerify(eab, mac, {
      algorithms: ['HS256', 'HS384', 'HS512'],
    });
    boundJwk = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    throw new AcmeError('unauthorized', 'External Account Binding signature is invalid');
  }
  if ((await thumbprint(publicJwk(boundJwk))) !== v.thumbprint) {
    throw new AcmeError('malformed', 'External Account Binding does not cover this account key');
  }

  const account: AcmeAccountsTable = {
    id: randomId('acct'),
    eab_id: credential.id,
    jwk: JSON.stringify(v.jwk),
    thumbprint: v.thumbprint,
    contact: JSON.stringify(parseContact(payload.contact)),
    status: 'valid',
    created_at: nowIso(),
  };
  await db().insertInto('acme_accounts').values(account).execute();
  await db()
    .updateTable('acme_eab_keys')
    .set({ last_used_at: nowIso() })
    .where('id', '=', credential.id)
    .execute();
  await audit(credential.id, 'acme.account.create', { target: account.id, req });

  return json(accountView(account, u), 201, { location: u.account(account.id) });
}

export async function updateAccount(req: Request, id: string): Promise<Response> {
  const u = urls(req);
  const { account, payload } = await session(req);
  if (account.id !== id) throw new AcmeError('unauthorized', 'Not your account');

  const patch: Partial<AcmeAccountsTable> = {};
  if (payload?.contact !== undefined) patch.contact = JSON.stringify(parseContact(payload.contact));
  if (payload?.status !== undefined) {
    if (payload.status !== 'deactivated') throw new AcmeError('malformed', 'status can only be set to "deactivated"');
    patch.status = 'deactivated';
  }
  if (Object.keys(patch).length > 0) {
    await db().updateTable('acme_accounts').set(patch).where('id', '=', id).execute();
    if (patch.status) await audit(account.eab_id, 'acme.account.deactivate', { target: id, req });
  }
  return json(accountView({ ...account, ...patch }, u));
}

export async function accountOrders(req: Request, id: string): Promise<Response> {
  const u = urls(req);
  const { account } = await session(req);
  if (account.id !== id) throw new AcmeError('unauthorized', 'Not your account');
  const rows = await db()
    .selectFrom('acme_orders')
    .select('id')
    .where('account_id', '=', id)
    .where('expires_at', '>', nowIso())
    .orderBy('created_at', 'desc')
    .limit(200)
    .execute();
  return json({ orders: rows.map((r) => u.order(r.id)) });
}

/* ------------------------------------------------------------------ orders */

type OrderStatus = 'pending' | 'ready' | 'processing' | 'valid' | 'invalid';
type AuthzStatus = 'pending' | 'valid' | 'invalid' | 'expired';

function expired(order: AcmeOrdersTable): boolean {
  return new Date(order.expires_at).getTime() < Date.now();
}

function authzStatus(order: AcmeOrdersTable, authz: AcmeAuthorizationsTable): AuthzStatus {
  if (order.upstream_status === 'failed') return 'invalid';
  if (authz.responded_type && order.upstream_status === 'ready') return 'valid';
  return expired(order) ? 'expired' : 'pending';
}

function orderStatus(order: AcmeOrdersTable, authzs: AcmeAuthorizationsTable[]): OrderStatus {
  if (order.status !== 'pending') return order.status;
  if (order.upstream_status === 'failed' || expired(order)) return 'invalid';
  return authzs.every((a) => authzStatus(order, a) === 'valid') ? 'ready' : 'pending';
}

function orderError(order: AcmeOrdersTable): AcmeProblem | undefined {
  if (order.error) return JSON.parse(order.error) as AcmeProblem;
  if (order.status === 'pending' && expired(order)) {
    return problemDocument('malformed', 'Order expired before it was finalized');
  }
  return undefined;
}

async function authzsOf(orderId: string): Promise<AcmeAuthorizationsTable[]> {
  return db()
    .selectFrom('acme_authorizations')
    .selectAll()
    .where('order_id', '=', orderId)
    .orderBy('created_at', 'asc')
    .orderBy('id', 'asc')
    .execute();
}

async function orderResponse(order: AcmeOrdersTable, u: Urls, status = 200): Promise<Response> {
  const authzs = await authzsOf(order.id);
  const state = orderStatus(order, authzs);
  const error = state === 'invalid' ? orderError(order) : undefined;
  return json(
    {
      status: state,
      expires: order.expires_at,
      identifiers: (JSON.parse(order.identifiers) as string[]).map((value) => ({ type: 'dns', value })),
      authorizations: authzs.map((a) => u.authz(a.id)),
      finalize: u.finalize(order.id),
      ...(state === 'valid' ? { certificate: u.certificate(order.id) } : {}),
      ...(error ? { error } : {}),
    },
    status,
    {
      location: u.order(order.id),
      ...(state === 'pending' || state === 'processing' ? RETRY_AFTER : {}),
    },
  );
}

async function ownedOrder(account: AcmeAccountsTable, id: string): Promise<AcmeOrdersTable> {
  const order = await db().selectFrom('acme_orders').selectAll().where('id', '=', id).executeTakeFirst();
  // Same answer for "missing" and "someone else's": ids must not be probeable.
  if (!order || order.account_id !== account.id) throw new AcmeError('malformed', 'Order not found', 404);
  return order;
}

function parseIdentifiers(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) {
    throw new AcmeError('malformed', '"identifiers" must hold between 1 and 100 entries');
  }
  const names: string[] = [];
  for (const item of raw as Array<{ type?: unknown; value?: unknown }>) {
    if (item?.type !== 'dns') {
      throw new AcmeError('unsupportedIdentifier', 'Only "dns" identifiers are supported');
    }
    const parsed = fqdnSchema.safeParse(item.value);
    if (!parsed.success) {
      throw new AcmeError('rejectedIdentifier', `"${String(item.value)}" is not a valid DNS name`);
    }
    if (!names.includes(parsed.data)) names.push(parsed.data);
  }
  return names;
}

export async function newOrder(req: Request): Promise<Response> {
  const u = urls(req);
  const { account, credential, payload } = await session(req);
  const names = parseIdentifiers(payload?.identifiers);

  const domains = await listDomains();
  const covering = names.map((name) => {
    const match = domains
      .filter((d) => belongsToDomain(name, d.name))
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (!match) throw new AcmeError('rejectedIdentifier', `No managed domain covers "${name}"`);
    return match;
  });
  const domain = covering[0];
  if (covering.some((d) => d.id !== domain.id)) {
    throw new AcmeError('rejectedIdentifier', 'All identifiers of an order must belong to the same managed domain');
  }
  if (!eabDomainIds(credential).includes(domain.id)) {
    throw new AcmeError('unauthorized', `This EAB credential is not allowed to issue under ${domain.name}`);
  }

  // A client retrying newOrder gets its live order back instead of a second upstream order.
  const fingerprint = JSON.stringify([...names].sort());
  const live = await db()
    .selectFrom('acme_orders')
    .selectAll()
    .where('account_id', '=', account.id)
    .where('identifiers', '=', fingerprint)
    .where('status', '=', 'pending')
    .where('upstream_status', '!=', 'failed')
    .where('expires_at', '>', nowIso())
    .executeTakeFirst();
  if (live) return orderResponse(live, u, 201);

  const cert = await createCertificate({
    domains: names,
    domainId: domain.id,
    keyType: 'external',
    autoRenew: false, // the ACME client renews by itself, with its own key
    renewBeforeDays: 30,
    webhookUrl: null,
    dnsRecord: null,
    metadata: { acme_account: account.id },
    createdBy: credential.id,
    idempotencyKey: null,
    source: 'acme',
  });

  const now = nowIso();
  const order: AcmeOrdersTable = {
    id: randomId('ord'),
    account_id: account.id,
    certificate_id: cert.id,
    identifiers: fingerprint,
    status: 'pending',
    upstream_status: 'idle',
    upstream_order_url: null,
    error: null,
    expires_at: new Date(Date.now() + ORDER_TTL_MS).toISOString(),
    created_at: now,
  };
  await db().insertInto('acme_orders').values(order).execute();
  await db()
    .insertInto('acme_authorizations')
    .values(
      names.map((name) => ({
        id: randomId('az'),
        order_id: order.id,
        identifier: name.replace(/^\*\./, ''),
        wildcard: name.startsWith('*.') ? 1 : 0,
        token: randomBytes(32).toString('base64url'),
        responded_type: null,
        created_at: now,
      })),
    )
    .execute();

  await audit(credential.id, 'acme.order.create', {
    target: cert.id,
    detail: { order: order.id, account: account.id, domains: names },
    req,
  });

  return orderResponse(order, u, 201);
}

/**
 * Runs the Route53 + upstream DNS-01 validation for the whole order, once:
 * the first answered challenge claims it, the others just wait on it.
 */
async function startUpstream(orderId: string, certId: string): Promise<void> {
  const claimed = await db()
    .updateTable('acme_orders')
    .set({ upstream_status: 'running' })
    .where('id', '=', orderId)
    .where('upstream_status', '=', 'idle')
    .executeTakeFirst();
  if (Number(claimed.numUpdatedRows ?? 0) === 0) return;
  // Locked like a worker-held order, so a crash mid-validation gets reclaimed.
  await db()
    .updateTable('certificates')
    .set({ locked_at: nowIso(), updated_at: nowIso() })
    .where('id', '=', certId)
    .execute();
  void validateUpstream(orderId, certId);
}

async function validateUpstream(orderId: string, certId: string): Promise<void> {
  try {
    const upstreamOrderUrl = await validateExternalOrder(certId);
    await db()
      .updateTable('acme_orders')
      .set({ upstream_status: 'ready', upstream_order_url: upstreamOrderUrl })
      .where('id', '=', orderId)
      .execute();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await db()
      .updateTable('acme_orders')
      .set({
        upstream_status: 'failed',
        error: JSON.stringify(problemDocument('serverInternal', `Upstream validation failed: ${detail}`)),
      })
      .where('id', '=', orderId)
      .execute()
      .catch((e) => console.error(`[acme-server] could not record failure of ${orderId}`, e));
  }
}

export async function getOrder(req: Request, id: string): Promise<Response> {
  const { account } = await session(req);
  return orderResponse(await ownedOrder(account, id), urls(req));
}

/* ---------------------------------------------- authorizations, challenges */

function challengeView(
  order: AcmeOrdersTable,
  authz: AcmeAuthorizationsTable,
  type: string,
  u: Urls,
) {
  const state = authzStatus(order, authz);
  const answered = authz.responded_type === type;
  const status =
    state === 'invalid' ? 'invalid' : !answered ? 'pending' : state === 'valid' ? 'valid' : 'processing';
  return {
    type,
    url: u.challenge(authz.id, type),
    token: authz.token,
    status,
    ...(status === 'invalid' && order.error ? { error: JSON.parse(order.error) as AcmeProblem } : {}),
  };
}

async function ownedAuthz(account: AcmeAccountsTable, id: string) {
  const authz = await db()
    .selectFrom('acme_authorizations')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  if (!authz) throw new AcmeError('malformed', 'Authorization not found', 404);
  const order = await ownedOrder(account, authz.order_id).catch(() => {
    throw new AcmeError('malformed', 'Authorization not found', 404);
  });
  return { authz, order };
}

export async function getAuthorization(req: Request, id: string): Promise<Response> {
  const u = urls(req);
  const { account } = await session(req);
  const { authz, order } = await ownedAuthz(account, id);
  const status = authzStatus(order, authz);
  // Once the client picked a challenge, only that one is relevant.
  const types = authz.responded_type ? [authz.responded_type] : CHALLENGE_TYPES;
  return json(
    {
      identifier: { type: 'dns', value: authz.identifier },
      status,
      expires: order.expires_at,
      challenges: types.map((t) => challengeView(order, authz, t, u)),
      ...(authz.wildcard ? { wildcard: true } : {}),
    },
    200,
    status === 'pending' ? RETRY_AFTER : {},
  );
}

export async function respondChallenge(req: Request, authzId: string, type: string): Promise<Response> {
  const u = urls(req);
  const { account, payload } = await session(req);
  if (!CHALLENGE_TYPES.includes(type)) throw new AcmeError('malformed', 'Challenge not found', 404);
  const found = await ownedAuthz(account, authzId);
  const { order } = found;
  let { authz } = found;

  // A non-empty payload ({}) is the "I am ready" signal; POST-as-GET just reads.
  if (payload !== null && !authz.responded_type && authzStatus(order, authz) === 'pending') {
    await db()
      .updateTable('acme_authorizations')
      .set({ responded_type: type })
      .where('id', '=', authz.id)
      .where('responded_type', 'is', null)
      .execute();
    authz = { ...authz, responded_type: type };
    await logEvent(order.certificate_id, 'acme.challenge', `Client answered ${type} for ${authz.identifier}`);
    await startUpstream(order.id, order.certificate_id);
  }

  const view = challengeView(order, authz, type, u);
  return json(view, 200, {
    link: `<${u.authz(authz.id)}>;rel="up"`,
    ...(view.status === 'processing' ? RETRY_AFTER : {}),
  });
}

/* ------------------------------------------------- finalize and download */

function csrToPem(b64url: string): string {
  const b64 = Buffer.from(b64url, 'base64url').toString('base64');
  if (!b64) throw new AcmeError('badCSR', '"csr" must be a base64url-encoded DER CSR');
  return `-----BEGIN CERTIFICATE REQUEST-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE REQUEST-----\n`;
}

export async function finalizeOrder(req: Request, id: string): Promise<Response> {
  const u = urls(req);
  const { account, credential, payload } = await session(req);
  const order = await ownedOrder(account, id);

  const state = orderStatus(order, await authzsOf(order.id));
  // Replayed finalize on an order already past "ready": report where it stands.
  if (state === 'processing' || state === 'valid') return orderResponse(order, u);
  if (state !== 'ready' || !order.upstream_order_url) {
    throw new AcmeError('orderNotReady', `Order is "${state}", not "ready"`);
  }

  if (typeof payload?.csr !== 'string') throw new AcmeError('malformed', '"csr" is required');
  const csrPem = csrToPem(payload.csr);
  let requested: Set<string>;
  try {
    const { commonName, altNames } = acme.crypto.readCsrDomains(csrPem);
    requested = new Set([commonName, ...altNames].filter(Boolean).map((n) => n.toLowerCase()));
  } catch {
    throw new AcmeError('badCSR', 'CSR could not be parsed');
  }
  const ordered = JSON.parse(order.identifiers) as string[];
  if (requested.size !== ordered.length || ordered.some((n) => !requested.has(n))) {
    throw new AcmeError('badCSR', 'CSR names do not match the order identifiers');
  }

  const claimed = await db()
    .updateTable('acme_orders')
    .set({ status: 'processing' })
    .where('id', '=', order.id)
    .where('status', '=', 'pending')
    .executeTakeFirst();
  if (Number(claimed.numUpdatedRows ?? 0) === 0) {
    return orderResponse(await ownedOrder(account, id), u);
  }
  await audit(credential.id, 'acme.order.finalize', { target: order.certificate_id, detail: { order: order.id }, req });

  const work = finalizeExternalOrder(order.certificate_id, order.upstream_order_url, csrPem)
    .then(() => db().updateTable('acme_orders').set({ status: 'valid' }).where('id', '=', order.id).execute())
    .catch((err) =>
      db()
        .updateTable('acme_orders')
        .set({
          status: 'invalid',
          error: JSON.stringify(
            problemDocument('serverInternal', `Upstream finalization failed: ${(err as Error).message}`),
          ),
        })
        .where('id', '=', order.id)
        .execute(),
    )
    .catch((err) => console.error(`[acme-server] could not record outcome of ${order.id}`, err));

  // Usually done in a couple of seconds; past that the client polls the order.
  await Promise.race([work, new Promise((r) => setTimeout(r, FINALIZE_WAIT_MS))]);
  return orderResponse(await ownedOrder(account, id), u);
}

export async function downloadCertificate(req: Request, orderId: string): Promise<Response> {
  const { account } = await session(req);
  const order = await ownedOrder(account, orderId).catch(() => {
    throw new AcmeError('malformed', 'Certificate not found', 404);
  });
  const cert = await db()
    .selectFrom('certificates')
    .select(['cert_pem', 'chain_pem', 'status'])
    .where('id', '=', order.certificate_id)
    .executeTakeFirst();
  if (order.status !== 'valid' || !cert?.cert_pem) {
    throw new AcmeError('malformed', 'Certificate not found', 404);
  }
  return new Response(`${cert.cert_pem}${cert.chain_pem ?? ''}`, {
    headers: { 'content-type': 'application/pem-certificate-chain' },
  });
}

export async function revokeCertificate(req: Request): Promise<Response> {
  const { account, credential, payload } = await session(req);
  if (typeof payload?.certificate !== 'string') throw new AcmeError('malformed', '"certificate" is required');
  const reason = payload.reason === undefined ? 0 : Number(payload.reason);
  if (!Number.isInteger(reason) || reason < 0 || reason > 10 || reason === 7) {
    throw new AcmeError('malformed', 'Invalid revocation reason code');
  }

  let fingerprint: string;
  try {
    fingerprint = new X509Certificate(Buffer.from(payload.certificate, 'base64url')).fingerprint256;
  } catch {
    throw new AcmeError('malformed', '"certificate" must be a base64url-encoded DER certificate');
  }

  const cert = await db()
    .selectFrom('certificates')
    .innerJoin('acme_orders', 'acme_orders.certificate_id', 'certificates.id')
    .select(['certificates.id', 'certificates.status'])
    .where('certificates.fingerprint_sha256', '=', fingerprint)
    .where('acme_orders.account_id', '=', account.id)
    .executeTakeFirst();
  if (!cert) throw new AcmeError('unauthorized', 'This account did not issue that certificate');
  if (cert.status === 'revoked') throw new AcmeError('alreadyRevoked', 'Certificate is already revoked');

  await revoke(cert.id, reason);
  await audit(credential.id, 'acme.certificate.revoke', { target: cert.id, detail: { reason }, req });
  return new Response(null, { status: 200 });
}

/* ------------------------------------------------------------ housekeeping */

/**
 * Orders the client walked away from: without this their certificate rows
 * would sit in "validating" forever. Called from the worker loop.
 */
export async function expireAbandonedOrders(): Promise<void> {
  const stale = await db()
    .selectFrom('acme_orders')
    .select(['id', 'certificate_id'])
    .where('status', '=', 'pending')
    .where('expires_at', '<', nowIso())
    .execute();

  for (const order of stale) {
    await db()
      .updateTable('acme_orders')
      .set({
        status: 'invalid',
        error: JSON.stringify(problemDocument('malformed', 'Order expired before it was finalized')),
      })
      .where('id', '=', order.id)
      .where('status', '=', 'pending')
      .execute();
    const res = await db()
      .updateTable('certificates')
      .set({
        status: 'failed',
        last_error: 'ACME order expired before the client finalized it',
        locked_at: null,
        updated_at: nowIso(),
      })
      .where('id', '=', order.certificate_id)
      .where('status', 'in', ['pending', 'dns_propagating', 'validating'])
      .executeTakeFirst();
    if (Number(res.numUpdatedRows ?? 0) > 0) {
      await logEvent(order.certificate_id, 'acme.expired', 'ACME order expired before finalization', 'warn');
    }
  }
}

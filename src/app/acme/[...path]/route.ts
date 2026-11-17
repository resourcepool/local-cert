import { ensureReady, isSetupComplete } from '@/lib/auth/setup';
import { AcmeError, json, newNonce, problemResponse, urls } from '@/lib/acme-server/protocol';
import * as acmeServer from '@/lib/acme-server/service';

export const dynamic = 'force-dynamic';

/**
 * RFC 8555 ACME server, everything under /acme/. One catch-all rather than a
 * file per resource: every request shares the same envelope (problem
 * documents, Replay-Nonce, Link index) and that is easier to guarantee here.
 *
 *   GET        /acme/directory
 *   HEAD, GET  /acme/new-nonce
 *   POST       /acme/new-account
 *   POST       /acme/acct/{id}            /acme/acct/{id}/orders
 *   POST       /acme/new-order
 *   POST       /acme/order/{id}           /acme/order/{id}/finalize
 *   POST       /acme/authz/{id}
 *   POST       /acme/chall/{authzId}/{type}
 *   POST       /acme/cert/{orderId}
 *   POST       /acme/revoke-cert
 */

type Ctx = { params: Promise<{ path: string[] }> };

const notFound = () => new AcmeError('malformed', 'No such ACME resource', 404);

async function route(req: Request, path: string[]): Promise<Response> {
  const [head, a, b] = path;
  const method = req.method.toUpperCase();
  const readOnly = method === 'GET' || method === 'HEAD';

  if (path.length === 1 && head === 'directory' && readOnly) return acmeServer.directory(req);
  if (path.length === 1 && head === 'new-nonce' && readOnly) {
    return new Response(null, { status: method === 'HEAD' ? 200 : 204 });
  }
  if (method !== 'POST') throw new AcmeError('malformed', 'ACME resources are fetched with a signed POST', 405);

  switch (head) {
    case 'new-account':
      if (path.length === 1) return acmeServer.newAccount(req);
      break;
    case 'new-order':
      if (path.length === 1) return acmeServer.newOrder(req);
      break;
    case 'revoke-cert':
      if (path.length === 1) return acmeServer.revokeCertificate(req);
      break;
    case 'acct':
      if (path.length === 2) return acmeServer.updateAccount(req, a);
      if (path.length === 3 && b === 'orders') return acmeServer.accountOrders(req, a);
      break;
    case 'order':
      if (path.length === 2) return acmeServer.getOrder(req, a);
      if (path.length === 3 && b === 'finalize') return acmeServer.finalizeOrder(req, a);
      break;
    case 'authz':
      if (path.length === 2) return acmeServer.getAuthorization(req, a);
      break;
    case 'chall':
      if (path.length === 3) return acmeServer.respondChallenge(req, a, b);
      break;
    case 'cert':
      if (path.length === 2) return acmeServer.downloadCertificate(req, a);
      break;
  }
  throw notFound();
}

async function handle(req: Request, ctx: Ctx): Promise<Response> {
  let res: Response;
  try {
    await ensureReady();
    if (!(await isSetupComplete())) {
      throw new AcmeError('serverInternal', 'This local-cert instance is not set up yet', 503);
    }
    res = await route(req, (await ctx.params).path);
  } catch (err) {
    if (err instanceof AcmeError) {
      res = problemResponse(err);
    } else {
      console.error('[acme-server] unhandled', err);
      res = problemResponse(new AcmeError('serverInternal', 'Unexpected server error'));
    }
  }

  // Every response carries a fresh nonce, errors included: a client that got
  // badNonce retries with this one.
  try {
    res.headers.set('replay-nonce', await newNonce());
  } catch (err) {
    console.error('[acme-server] could not mint a nonce', err);
    return json({ type: 'urn:ietf:params:acme:error:serverInternal', detail: 'Nonce store unavailable' }, 500);
  }
  res.headers.set('link', [res.headers.get('link'), `<${urls(req).directory}>;rel="index"`].filter(Boolean).join(', '));
  res.headers.set('cache-control', 'no-store');
  return res;
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;

import { handler, ApiError } from '@/lib/http';
import { requireAuth } from '@/lib/auth/guard';
import { handleMessage, rpcError, type JsonRpcResponse } from '@/lib/mcp/server';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/**
 * POST /api/mcp — Model Context Protocol endpoint (Streamable HTTP, stateless).
 *
 * Authentication is the REST API's: `Authorization: Bearer <api key or JWT>`.
 * Unlike /api/v1 there is no session-cookie fallback — a browser has no
 * business here, and refusing the cookie keeps the endpoint out of reach of
 * any cross-site request.
 *
 * GET (the optional server-to-client stream) is deliberately not implemented:
 * this server never initiates a message, and the transport allows 405 there.
 */
export const POST = handler(async (req: Request) => {
  if (!req.headers.get('authorization')?.toLowerCase().startsWith('bearer ')) {
    throw new ApiError('unauthorized', 'Missing or invalid credentials');
  }
  const principal = await requireAuth(req);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400);
  }

  const ctx = { req, principal };

  // Batches exist in protocol versions up to 2025-03-26.
  if (Array.isArray(payload)) {
    if (payload.length === 0) return json(rpcError(null, -32600, 'Invalid request'), 400);
    const responses: JsonRpcResponse[] = [];
    for (const message of payload) {
      const response = await handleMessage(message, ctx);
      if (response) responses.push(response);
    }
    return responses.length ? json(responses) : new Response(null, { status: 202 });
  }

  const response = await handleMessage(payload, ctx);
  return response ? json(response) : new Response(null, { status: 202 });
});

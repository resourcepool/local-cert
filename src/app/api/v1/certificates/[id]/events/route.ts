import { db } from '@/lib/db';
import { handler, ok, ApiError } from '@/lib/http';
import { requireAuth, requireScope } from '@/lib/auth/guard';
import { SCOPES } from '@/lib/scopes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/certificates/{id}/events            -> JSON history
 * GET /api/v1/certificates/{id}/events?stream=1   -> SSE, live order progress
 */
export const GET = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const principal = await requireAuth(req);
  const { id } = await ctx.params;

  const cert = await db()
    .selectFrom('certificates')
    .select(['id', 'domain_id', 'status'])
    .where('id', '=', id)
    .executeTakeFirst();
  if (!cert) throw new ApiError('not_found', 'Certificate not found');
  requireScope(principal, cert.domain_id, SCOPES.CERT_READ);

  const url = new URL(req.url);
  if (url.searchParams.get('stream') !== '1') {
    const events = await db()
      .selectFrom('certificate_events')
      .selectAll()
      .where('certificate_id', '=', id)
      .orderBy('at', 'asc')
      .execute();
    return ok({ id, status: cert.status, events });
  }

  const encoder = new TextEncoder();
  let lastAt = url.searchParams.get('since') ?? '';
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      req.signal.addEventListener('abort', () => {
        closed = true;
      });

      // Terminal states end the stream; anything else keeps polling the table.
      while (!closed) {
        const rows = await db()
          .selectFrom('certificate_events')
          .selectAll()
          .where('certificate_id', '=', id)
          .where('at', '>', lastAt)
          .orderBy('at', 'asc')
          .execute();

        for (const row of rows) {
          send('event', row);
          lastAt = row.at;
        }

        const current = await db()
          .selectFrom('certificates')
          .select(['status'])
          .where('id', '=', id)
          .executeTakeFirst();
        send('status', { status: current?.status });

        if (current && ['issued', 'revoked', 'expired'].includes(current.status)) break;
        if (current?.status === 'failed') break;

        await new Promise((r) => setTimeout(r, 2000));
      }

      send('done', { status: 'closed' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
});

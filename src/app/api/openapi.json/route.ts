import { handler, ok } from '@/lib/http';
import { requireAuth } from '@/lib/auth/guard';
import { generateOpenApiDocument } from '@/lib/openapi';

export const dynamic = 'force-dynamic';

/** Authenticated: the schema maps the whole attack surface of an internal tool. */
export const GET = handler(async (req: Request) => {
  await requireAuth(req);
  return ok(generateOpenApiDocument(), {
    headers: { 'cache-control': 'no-store', 'content-type': 'application/json' },
  });
});

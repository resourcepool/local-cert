import { z } from 'zod';
import { apiRegistry } from '@/lib/api/schemas';
import { ROUTES, TAGS, type RouteDef, type Security } from '@/lib/api/routes';
import { appEnv } from '@/lib/env';

/**
 * Generates the OpenAPI 3.1 document from the zod schemas the handlers use.
 *
 * Nothing here is written twice: request bodies come straight from
 * validation.ts, responses from api/schemas.ts (tied to the runtime via
 * z.infer), and the operation list from api/routes.ts, which
 * `npm run openapi:check` verifies against the filesystem.
 */

const COMPONENT_PREFIX = '#/components/schemas/';

type Json = Record<string, unknown>;

/**
 * Drops JSON Schema bookkeeping OpenAPI does not want, and rewrites the local
 * `#/$defs/X` refs zod emits for inline schemas onto the component namespace.
 */
function normalise(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalise);
  if (node && typeof node === 'object') {
    const out: Json = {};
    for (const [k, v] of Object.entries(node as Json)) {
      if (k === '$schema' || k === '$id' || k === '$defs') continue;
      if (k === '$ref' && typeof v === 'string' && v.startsWith('#/$defs/')) {
        out[k] = `${COMPONENT_PREFIX}${v.slice('#/$defs/'.length)}`;
        continue;
      }
      out[k] = normalise(v);
    }
    return out;
  }
  return node;
}

/**
 * One conversion pass, in input mode: request bodies carry defaults, and no
 * registered response schema uses a transform or default (openapi:check
 * asserts that, so this stays true).
 */
function buildComponents(): Record<string, Json> {
  const { schemas } = z.toJSONSchema(apiRegistry, {
    target: 'draft-2020-12',
    io: 'input',
    unrepresentable: 'any',
    uri: (id) => `${COMPONENT_PREFIX}${id}`,
  });
  return Object.fromEntries(
    Object.entries(schemas).map(([id, schema]) => [id, normalise(schema) as Json]),
  );
}

/** A registered schema becomes a $ref; anything ad hoc is inlined. */
function schemaFor(schema: z.ZodType): Json {
  const meta = apiRegistry.get(schema) as { id?: string } | undefined;
  if (meta?.id) return { $ref: `${COMPONENT_PREFIX}${meta.id}` };
  return normalise(
    z.toJSONSchema(schema, {
      target: 'draft-2020-12',
      io: 'input',
      unrepresentable: 'any',
      metadata: apiRegistry,
      uri: (id: string) => `${COMPONENT_PREFIX}${id}`,
    } as Parameters<typeof z.toJSONSchema>[1]),
  ) as Json;
}

function securityFor(security: Security | undefined): unknown[] | undefined {
  switch (security ?? 'bearer') {
    case 'none':
      return [];
    case 'session':
      return [{ sessionCookie: [] }];
    default:
      return [{ bearerAuth: [] }];
  }
}

function operationFor(route: RouteDef): Json {
  const op: Json = {
    tags: [route.tag],
    summary: route.summary,
    operationId: `${route.method}${route.path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
  };
  if (route.description) op.description = route.description;

  const security = securityFor(route.security);
  if (security !== undefined) op.security = security;

  if (route.params?.length) {
    op.parameters = route.params.map((p) => ({
      name: p.name,
      in: p.in,
      required: p.required ?? p.in === 'path',
      schema: schemaFor(p.schema),
      ...(p.description ? { description: p.description } : {}),
      ...(p.example ? { example: p.example } : {}),
    }));
  }

  if (route.body) {
    op.requestBody = {
      required: route.body.required ?? false,
      ...(route.body.description ? { description: route.body.description } : {}),
      content: { 'application/json': { schema: schemaFor(route.body.schema) } },
    };
  }

  op.responses = Object.fromEntries(
    Object.entries(route.responses).map(([code, r]) => [
      code,
      {
        description: r.description,
        ...(r.schema
          ? { content: { [r.contentType ?? 'application/json']: { schema: schemaFor(r.schema) } } }
          : {}),
      },
    ]),
  );

  return op;
}

export function generateOpenApiDocument(): Json {
  const paths: Record<string, Json> = {};
  for (const route of ROUTES) {
    paths[route.path] ??= {};
    (paths[route.path] as Json)[route.method] = operationFor(route);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'local-cert',
      version: '0.1.0',
      description:
        "Let's Encrypt certificates for LAN hosts, issued over the DNS-01 challenge against a Route53 hosted zone.\n\n" +
        'Authenticate with an API key directly, or exchange it for a short-lived JWT at `POST /api/v1/auth/token`. ' +
        'The admin console uses a session cookie carrying an equivalent JWT — which is why the explorer can call the API without a token.\n\n' +
        `This instance runs in ${appEnv()}: the password policy and the default ACME directory follow from that.`,
    },
    servers: [{ url: '/', description: 'This instance' }],
    tags: TAGS.map((t) => ({ ...t })),
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description:
            'An API key (`lc_…`, or an opaque ADMIN_API_KEY) or a JWT from `/api/v1/auth/token`.',
        },
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'lc_session',
          description: 'Admin console session, set by `POST /api/admin/session`.',
        },
      },
      schemas: buildComponents(),
    },
    paths,
  };
}

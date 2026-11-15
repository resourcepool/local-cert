import { z } from 'zod';
import { type Principal, scopesOn, visibleDomainIds } from '@/lib/auth/guard';
import { SCOPES } from '@/lib/scopes';
import { listDomains } from '@/lib/certificates';
import { certificateStatusSchema } from '@/lib/api/schemas';
import {
  createApiKeySchema,
  createCertificateSchema,
  createDomainSchema,
  dnsRecordSchema,
  fqdnSchema,
  updateGrantsSchema,
  updateMetadataSchema,
} from '@/lib/validation';
import { createDomain, deleteDomain, listDomainsWithCounts } from '@/lib/admin/domains';
import { createApiKey, deleteApiKey, listApiKeys, updateApiKey } from '@/lib/admin/keys';
import { getStats } from '@/lib/admin/stats';
import * as certificatesRoute from '@/app/api/v1/certificates/route';
import * as certificateRoute from '@/app/api/v1/certificates/[id]/route';
import * as renewRoute from '@/app/api/v1/certificates/[id]/renew/route';
import * as bundleRoute from '@/app/api/v1/certificates/[id]/bundle/route';
import * as eventsRoute from '@/app/api/v1/certificates/[id]/events/route';
import * as subdomainRoute from '@/app/api/v1/subdomains/[fqdn]/route';
import * as dnsRoute from '@/app/api/v1/dns/records/route';
import * as acmeRoute from '@/app/api/v1/acme/account/route';

/**
 * The MCP tool catalogue.
 *
 * Non-admin tools do not reimplement anything: each one calls the matching
 * /api/v1 route handler in-process, with the caller's own Authorization header.
 * Authentication, scope checks, validation and audit logging are therefore the
 * REST API's, by construction — a key can never do more through MCP than it can
 * with curl.
 *
 * Admin tools call the services in src/lib/admin, which the console routes also
 * use. The console authenticates those with its session cookie; here the MCP
 * server checks for an admin key before any admin tool runs (see server.ts).
 */

export interface ToolContext {
  /** the MCP HTTP request — source of the Authorization header and client IP */
  req: Request;
  principal: Principal;
}

export type SkillGroup = 'general' | 'certificates' | 'dns' | 'admin';

export interface ToolDef<S extends z.ZodType = z.ZodType> {
  name: string;
  title: string;
  description: string;
  /** admin tools are hidden from, and refused to, non-admin keys */
  admin: boolean;
  /** human-readable permission requirement, shown in the skills */
  requires: string;
  group: SkillGroup;
  input: S;
  annotations: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  /** returns a JSON-serialisable object, or a string for plain-text results */
  run: (ctx: ToolContext, args: z.output<S>) => Promise<unknown>;
}

export function tool<S extends z.ZodType>(def: ToolDef<S>): ToolDef {
  return def as unknown as ToolDef;
}

/** A failure the calling model should see and can act on. */
export class ToolError extends Error {
  constructor(
    readonly type: string,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

export function isAdminPrincipal(p: Principal): boolean {
  return p.isAdmin || p.globalScopes.includes(SCOPES.ADMIN);
}

const schemaCache = new WeakMap<ToolDef, Record<string, unknown>>();

export function inputSchemaOf(t: ToolDef): Record<string, unknown> {
  let schema = schemaCache.get(t);
  if (!schema) {
    schema = z.toJSONSchema(t.input, { io: 'input', unrepresentable: 'any' }) as Record<
      string,
      unknown
    >;
    schemaCache.set(t, schema);
  }
  return schema;
}

type RouteHandler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

interface RestCall<P> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  params?: P;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Runs a REST route handler in-process as the calling principal. */
async function rest<P = Record<string, never>>(
  ctx: ToolContext,
  fn: RouteHandler<P>,
  call: RestCall<P>,
): Promise<unknown> {
  const url = new URL(call.path, ctx.req.url);
  for (const [k, v] of Object.entries(call.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const headers = new Headers(call.headers);
  for (const name of ['authorization', 'x-forwarded-for', 'x-real-ip']) {
    const value = ctx.req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (call.body !== undefined) headers.set('content-type', 'application/json');

  const res = await fn(
    new Request(url, {
      method: call.method,
      headers,
      body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
    }),
    { params: Promise.resolve((call.params ?? {}) as P) },
  );

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new ToolError(
      typeof data.type === 'string' ? data.type : 'internal_error',
      typeof data.title === 'string' ? data.title : `HTTP ${res.status}`,
      data.detail,
    );
  }
  return data;
}

const certId = z.string().min(1).describe('Certificate id, e.g. "cert_…"');
const empty = z.object({});

const READ = { readOnlyHint: true, openWorldHint: false } as const;

export const FEATURE_TOOLS: ToolDef[] = [
  // ── general ────────────────────────────────────────────────────────────────
  tool({
    name: 'whoami',
    title: 'Who am I',
    description:
      'Describes the API key in use: its name, whether it is an admin key, and the managed ' +
      'domains it can see with the scopes it holds on each. Call this first to learn which ' +
      'other tools will succeed and which domain ids to use.',
    admin: false,
    requires: 'any valid key',
    group: 'general',
    input: empty,
    annotations: READ,
    run: async ({ principal }) => {
      const visible = visibleDomainIds(principal);
      const domains = (await listDomains()).filter(
        (d) => visible === 'all' || visible.includes(d.id),
      );
      return {
        name: principal.name,
        kind: principal.kind,
        is_admin: isAdminPrincipal(principal),
        global_scopes: principal.globalScopes,
        domains: domains.map((d) => ({
          id: d.id,
          name: d.name,
          scopes: scopesOn(principal, d.id),
        })),
      };
    },
  }),
  tool({
    name: 'get_acme_account',
    title: 'ACME account status',
    description:
      'Shows the ACME (Let\'s Encrypt) account this instance issues with: environment ' +
      '(staging or production), directory URL and contact. Use it to tell whether issued ' +
      'certificates will be publicly trusted.',
    admin: false,
    requires: 'any valid key',
    group: 'general',
    input: empty,
    annotations: READ,
    run: (ctx) => rest(ctx, acmeRoute.GET, { method: 'GET', path: '/api/v1/acme/account' }),
  }),

  // ── certificates ───────────────────────────────────────────────────────────
  tool({
    name: 'list_certificates',
    title: 'List certificates',
    description:
      'Lists certificates on the domains this key can see, newest first. All filters are ' +
      'optional and combine with AND.',
    admin: false,
    requires: 'a grant on the domain (results are limited to visible domains)',
    group: 'certificates',
    input: z.object({
      status: z.enum(certificateStatusSchema.options).optional().describe('Exact status'),
      domain: z.string().optional().describe('Substring match on the certificate names (SANs)'),
      expires_within_days: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Only certificates expiring within this many days'),
      metadata: z
        .record(z.string(), z.string())
        .optional()
        .describe('Exact match on metadata entries, e.g. {"tenant_id": "acme-corp"}'),
      limit: z.number().int().min(1).max(1000).default(200),
    }),
    annotations: READ,
    run: (ctx, a) =>
      rest(ctx, certificatesRoute.GET, {
        method: 'GET',
        path: '/api/v1/certificates',
        query: {
          status: a.status,
          domain: a.domain,
          expires_within_days: a.expires_within_days,
          limit: a.limit,
          ...Object.fromEntries(
            Object.entries(a.metadata ?? {}).map(([k, v]) => [`metadata.${k}`, v]),
          ),
        },
      }),
  }),
  tool({
    name: 'request_certificate',
    title: 'Request a certificate',
    description:
      'Queues issuance of a Let\'s Encrypt certificate for one or more names under a single ' +
      'managed domain (wildcards allowed as a leading "*."). Returns immediately with status ' +
      '"pending"; issuance runs in the background and takes one to a few minutes — poll ' +
      'get_certificate or get_certificate_events until the status is "issued" or "failed". ' +
      'Set dns.create_record with dns.target_ip to also publish an A record pointing the ' +
      'first non-wildcard name at a LAN IP (needs dns:write). Pass idempotency_key to make a ' +
      'retry return the original order instead of creating a second one.',
    admin: false,
    requires: 'cert:issue on the domain (plus dns:write when dns.create_record is set)',
    group: 'certificates',
    input: createCertificateSchema.extend({
      idempotency_key: z
        .string()
        .min(1)
        .max(200)
        .optional()
        .describe('Any stable string; the same key returns the same order for this API key'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: (ctx, { idempotency_key, ...body }) =>
      rest(ctx, certificatesRoute.POST, {
        method: 'POST',
        path: '/api/v1/certificates',
        body,
        headers: idempotency_key ? { 'idempotency-key': idempotency_key } : undefined,
      }),
  }),
  tool({
    name: 'get_certificate',
    title: 'Get a certificate',
    description:
      'Returns one certificate: status, names, validity dates, days remaining, renewal ' +
      'settings and metadata. Contains no key material — use get_certificate_bundle for PEMs.',
    admin: false,
    requires: 'cert:read on the domain',
    group: 'certificates',
    input: z.object({ id: certId }),
    annotations: READ,
    run: (ctx, { id }) =>
      rest(ctx, certificateRoute.GET, {
        method: 'GET',
        path: `/api/v1/certificates/${encodeURIComponent(id)}`,
        params: { id },
      }),
  }),
  tool({
    name: 'get_certificate_events',
    title: 'Certificate event log',
    description:
      'Returns the issuance event history of a certificate (DNS challenge, propagation, ' +
      'validation, errors) with its current status. This is where the reason for a "failed" ' +
      'status is recorded.',
    admin: false,
    requires: 'cert:read on the domain',
    group: 'certificates',
    input: z.object({ id: certId }),
    annotations: READ,
    run: (ctx, { id }) =>
      rest(ctx, eventsRoute.GET, {
        method: 'GET',
        path: `/api/v1/certificates/${encodeURIComponent(id)}/events`,
        params: { id },
      }),
  }),
  tool({
    name: 'get_certificate_bundle',
    title: 'Export certificate PEMs',
    description:
      'Returns the PEM material of an issued certificate. By default only the public full ' +
      'chain. Including "key" returns the PRIVATE KEY in this conversation: do it only when ' +
      'the user asked for the key, and never repeat it elsewhere. Every export is audited.',
    admin: false,
    requires: 'cert:read on the domain (plus cert:export when "key" is included)',
    group: 'certificates',
    input: z.object({
      id: certId,
      include: z
        .array(z.enum(['fullchain', 'cert', 'chain', 'key']))
        .min(1)
        .default(['fullchain'])
        .describe('Parts to return; "key" is the private key and needs cert:export'),
    }),
    annotations: READ,
    run: (ctx, { id, include }) =>
      rest(ctx, bundleRoute.GET, {
        method: 'GET',
        path: `/api/v1/certificates/${encodeURIComponent(id)}/bundle`,
        params: { id },
        query: { format: 'json', include: include.join(',') },
      }),
  }),
  tool({
    name: 'renew_certificate',
    title: 'Renew a certificate now',
    description:
      'Re-queues issuance for an existing certificate immediately, without waiting for the ' +
      'automatic renewal window. Fails with a conflict if an issuance is already running or ' +
      'the certificate is revoked. Poll get_certificate afterwards.',
    admin: false,
    requires: 'cert:renew on the domain',
    group: 'certificates',
    input: z.object({ id: certId }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: (ctx, { id }) =>
      rest(ctx, renewRoute.POST, {
        method: 'POST',
        path: `/api/v1/certificates/${encodeURIComponent(id)}/renew`,
        params: { id },
      }),
  }),
  tool({
    name: 'update_certificate_metadata',
    title: 'Update certificate metadata',
    description:
      'Sets the free-form business metadata (string keys and values: tenant, environment, ' +
      'ticket…) attached to a certificate. mode "merge" (default) adds or overwrites the given ' +
      'keys; "replace" discards the existing map. Nothing else about a certificate is mutable.',
    admin: false,
    requires: 'cert:issue on the domain',
    group: 'certificates',
    input: updateMetadataSchema.extend({ id: certId }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    run: (ctx, { id, ...body }) =>
      rest(ctx, certificateRoute.PATCH, {
        method: 'PATCH',
        path: `/api/v1/certificates/${encodeURIComponent(id)}`,
        params: { id },
        body,
      }),
  }),
  tool({
    name: 'revoke_certificate',
    title: 'Revoke or delete a certificate',
    description:
      'Revokes a certificate at the CA, destroys its stored private key and removes the A ' +
      'record local-cert created for it. Irreversible. With purge=true the row is deleted as ' +
      'well; otherwise it stays, with status "revoked". Anything that could not be cleaned up ' +
      'is reported in "warnings".',
    admin: false,
    requires: 'cert:revoke on the domain',
    group: 'certificates',
    input: z.object({
      id: certId,
      purge: z.boolean().default(false).describe('Also delete the certificate record'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    run: (ctx, { id, purge }) =>
      rest(ctx, certificateRoute.DELETE, {
        method: 'DELETE',
        path: `/api/v1/certificates/${encodeURIComponent(id)}`,
        params: { id },
        query: { purge: purge ? 'true' : undefined },
      }),
  }),

  // ── subdomains and DNS ─────────────────────────────────────────────────────
  tool({
    name: 'check_subdomain',
    title: 'Is this subdomain taken?',
    description:
      'Checks a name against both sources of truth: the Route53 zone (any record with that ' +
      'name) and local-cert (a non-revoked certificate covering it). "available" is true only ' +
      'when neither knows the name and the zone could be read. Call it before ' +
      'request_certificate to avoid colliding with an existing host.',
    admin: false,
    requires: 'cert:read on the covering domain',
    group: 'dns',
    input: z.object({ fqdn: fqdnSchema }),
    annotations: { readOnlyHint: true, openWorldHint: true },
    run: (ctx, { fqdn }) =>
      rest(ctx, subdomainRoute.GET, {
        method: 'GET',
        path: `/api/v1/subdomains/${encodeURIComponent(fqdn)}`,
        params: { fqdn: encodeURIComponent(fqdn) },
      }),
  }),
  tool({
    name: 'list_dns_records',
    title: 'List DNS records',
    description:
      'Lists the Route53 records of the managed domains this key can see, grouped by domain. ' +
      'Pass domain_id to restrict to one. Fails if the key lacks dns:read on any listed domain.',
    admin: false,
    requires: 'dns:read on every listed domain',
    group: 'dns',
    input: z.object({
      domain_id: z.string().optional().describe('Managed domain id, from whoami'),
    }),
    annotations: { readOnlyHint: true, openWorldHint: true },
    run: (ctx, { domain_id }) =>
      rest(ctx, dnsRoute.GET, {
        method: 'GET',
        path: '/api/v1/dns/records',
        query: { domain_id },
      }),
  }),
  tool({
    name: 'upsert_dns_record',
    title: 'Create or replace a DNS record',
    description:
      'Creates the record, or replaces the whole value set of an existing record with the ' +
      'same name and type, in the Route53 zone of the covering managed domain. Waits up to a ' +
      'minute for Route53 to apply it. _acme-challenge names are refused: the issuance worker ' +
      'owns them.',
    admin: false,
    requires: 'dns:write on the covering domain',
    group: 'dns',
    input: dnsRecordSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    run: (ctx, body) =>
      rest(ctx, dnsRoute.PUT, { method: 'PUT', path: '/api/v1/dns/records', body }),
  }),
  tool({
    name: 'delete_dns_record',
    title: 'Delete a DNS record',
    description:
      'Deletes one record from the Route53 zone. Route53 only deletes on an exact match, so ' +
      'type, values and ttl must equal the existing record — read them with list_dns_records ' +
      'first. Values containing a comma cannot be deleted through this tool.',
    admin: false,
    requires: 'dns:write on the covering domain',
    group: 'dns',
    input: dnsRecordSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    run: (ctx, { fqdn, type, values, ttl }) => {
      if (values.some((v) => v.includes(','))) {
        throw new ToolError(
          'validation_error',
          'Record values containing a comma cannot be deleted through this tool',
        );
      }
      return rest(ctx, dnsRoute.DELETE, {
        method: 'DELETE',
        path: '/api/v1/dns/records',
        query: { fqdn, type, values: values.join(','), ttl },
      });
    },
  }),

  // ── admin ──────────────────────────────────────────────────────────────────
  tool({
    name: 'admin_get_stats',
    title: 'Instance statistics',
    description:
      'Instance dashboard: certificate counts by status, certificates expiring within 30 ' +
      'days, number of managed domains and active API keys, database dialect, ACME account ' +
      'status and the 15 most recent audit log entries.',
    admin: true,
    requires: 'admin key',
    group: 'admin',
    input: empty,
    annotations: READ,
    run: () => getStats(),
  }),
  tool({
    name: 'admin_list_domains',
    title: 'List managed domains',
    description:
      'Lists every managed domain with its Route53 zone id, AWS region, optional role ARN, ' +
      'default TTL and certificate count.',
    admin: true,
    requires: 'admin key',
    group: 'admin',
    input: empty,
    annotations: READ,
    run: () => listDomainsWithCounts(),
  }),
  tool({
    name: 'admin_create_domain',
    title: 'Register a managed domain',
    description:
      'Registers a base domain and the Route53 hosted zone that serves it, after which keys ' +
      'can be granted scopes on it. Runs a Route53 permission preflight first and refuses if ' +
      'the hosted zone does not cover the name, or (unless force=true) if required ' +
      'permissions are missing; the per-check results come back in the error detail.',
    admin: true,
    requires: 'admin key',
    group: 'admin',
    input: createDomainSchema.extend({
      force: z
        .boolean()
        .default(false)
        .describe('Register even though the Route53 permission preflight failed'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: ({ principal, req }, { force, ...body }) => createDomain(principal, body, { force, req }),
  }),
  tool({
    name: 'admin_delete_domain',
    title: 'Remove a managed domain',
    description:
      'Removes a managed domain and every grant on it. Refused while the domain still has ' +
      'certificates of any status, unless force=true, which first revokes them at the CA, ' +
      'cleans their DNS records, and deletes them. Irreversible; with force it destroys every ' +
      'certificate and private key of the domain.',
    admin: true,
    requires: 'admin key',
    group: 'admin',
    input: z.object({
      id: z.string().min(1).describe('Managed domain id, e.g. "dom_…"'),
      force: z
        .boolean()
        .default(false)
        .describe('Revoke and delete the domain\'s certificates along with it'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    run: ({ principal, req }, { id, force }) => deleteDomain(principal, id, { force, req }),
  }),
  tool({
    name: 'admin_list_api_keys',
    title: 'List API keys',
    description:
      'Lists every API key with its prefix, admin flag, expiry, last use, revocation state ' +
      'and per-domain grants. Secrets are never returned.',
    admin: true,
    requires: 'admin key',
    group: 'admin',
    input: empty,
    annotations: READ,
    run: () => listApiKeys(),
  }),
  tool({
    name: 'admin_create_api_key',
    title: 'Mint an API key',
    description:
      'Mints an API key. Either is_admin=true (full access to everything, including these ' +
      'admin tools) or a list of grants, each giving scopes on one managed domain. The ' +
      'response contains the plaintext token ONCE and it can never be retrieved again: hand ' +
      'it to the user immediately and do not store or repeat it elsewhere.',
    admin: true,
    requires: 'admin key',
    group: 'admin',
    input: createApiKeySchema,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    run: ({ principal, req }, body) => createApiKey(principal, body, req),
  }),
  tool({
    name: 'admin_update_api_key',
    title: 'Update an API key',
    description:
      'Renames a key, revokes or restores it, and/or replaces its grants. "grants" replaces ' +
      'the WHOLE grant set: include every domain the key should keep, and pass an empty ' +
      'scopes array (or omit the domain) to remove access to one. Revocation takes effect ' +
      'immediately for the raw key; JWTs already exchanged from it stay valid until they ' +
      'expire.',
    admin: true,
    requires: 'admin key',
    group: 'admin',
    input: z.object({
      id: z.string().min(1).describe('API key id, e.g. "key_…"'),
      name: z.string().trim().min(1).max(80).optional(),
      revoked: z.boolean().optional().describe('true revokes the key, false restores it'),
      grants: updateGrantsSchema.shape.grants.optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    run: ({ principal, req }, { id, ...patch }) => updateApiKey(principal, id, patch, req),
  }),
  tool({
    name: 'admin_delete_api_key',
    title: 'Delete an API key',
    description:
      'Permanently deletes an API key and its grants. Prefer revoking (admin_update_api_key ' +
      'with revoked=true) when the key may need to be restored. The key used for this ' +
      'request cannot delete itself.',
    admin: true,
    requires: 'admin key',
    group: 'admin',
    input: z.object({ id: z.string().min(1).describe('API key id, e.g. "key_…"') }),
    annotations: { readOnlyHint: false, destructiveHint: true },
    run: ({ principal, req }, { id }) => deleteApiKey(principal, id, req),
  }),
];

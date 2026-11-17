import { z } from 'zod';
import * as S from './schemas';

/**
 * The route table the OpenAPI document is generated from.
 *
 * Paths and methods here are cross-checked against the filesystem by
 * `npm run openapi:check`, which fails on any App Router handler that is not
 * listed — so a new endpoint cannot ship undocumented. The schemas are the zod
 * objects the handlers actually validate with.
 */

export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
export type Security = 'bearer' | 'session' | 'none';

export interface ParamDef {
  name: string;
  in: 'path' | 'query' | 'header';
  schema: z.ZodType;
  required?: boolean;
  description?: string;
  example?: string;
}

export interface ResponseDef {
  description: string;
  schema?: z.ZodType;
  contentType?: string;
}

export interface RouteDef {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  description?: string;
  security?: Security;
  params?: ParamDef[];
  body?: { schema: z.ZodType; required?: boolean; description?: string };
  responses: Record<number, ResponseDef>;
}

const problem = (description: string): ResponseDef => ({ description, schema: S.problemSchema });
const str = z.string();
const int = z.int();
const bool = z.boolean();

const idParam: ParamDef = { name: 'id', in: 'path', schema: str, required: true };

export const TAGS = [
  { name: 'Setup', description: 'One-shot instance bootstrap' },
  { name: 'Auth', description: 'API key to JWT exchange' },
  { name: 'Certificates', description: 'Issue, renew, export, revoke' },
  { name: 'Subdomains', description: 'Availability lookup' },
  { name: 'DNS', description: 'Direct record management' },
  { name: 'Admin', description: 'Console-only: domains, keys, stats' },
  { name: 'ACME server', description: 'Credentials for ACME clients using /acme/directory' },
  { name: 'Ops', description: 'Health, ACME account, this document' },
  { name: 'MCP', description: 'Model Context Protocol endpoint for AI agents' },
] as const;

export const ROUTES: RouteDef[] = [
  {
    method: 'get',
    path: '/api/healthz',
    tag: 'Ops',
    summary: 'Liveness and database reachability',
    security: 'none',
    responses: {
      200: { description: 'Healthy', schema: S.healthSchema },
      500: problem('Database unreachable'),
    },
  },

  {
    method: 'get',
    path: '/api/setup',
    tag: 'Setup',
    summary: 'Setup state, environment and password policy',
    description:
      'The password policy is derived from APP_ENV: enforced in production, absent in development.',
    security: 'none',
    responses: { 200: { description: 'OK', schema: S.setupStatusSchema } },
  },
  {
    method: 'post',
    path: '/api/setup',
    tag: 'Setup',
    summary: 'Create the admin account (once)',
    description:
      'Permanently closed once completed. Can also be provisioned before first boot with ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_API_KEY.',
    security: 'none',
    body: { schema: S.requests.setup, required: true },
    responses: {
      201: { description: 'Created; the session cookie is set', schema: S.setupResultSchema },
      409: problem('Setup already completed'),
      422: problem('Invalid payload, or the password fails the active policy'),
    },
  },

  {
    method: 'post',
    path: '/api/v1/auth/token',
    tag: 'Auth',
    summary: 'Exchange an API key for a short-lived JWT',
    body: { schema: S.requests.token },
    responses: {
      200: { description: 'Issued', schema: S.tokenResponseSchema },
      401: problem('Invalid, revoked or expired key'),
    },
  },

  {
    method: 'get',
    path: '/api/v1/certificates',
    tag: 'Certificates',
    summary: 'List certificates',
    params: [
      { name: 'status', in: 'query', schema: S.certificateStatusSchema },
      { name: 'domain', in: 'query', schema: str, description: 'Substring match on the SANs.' },
      { name: 'expires_within_days', in: 'query', schema: int },
      { name: 'limit', in: 'query', schema: int.default(200) },
      {
        name: 'metadata.<key>',
        in: 'query',
        schema: str,
        description: 'Exact match on one metadata entry, e.g. metadata.tenant_id=acme-corp.',
      },
    ],
    responses: { 200: { description: 'OK', schema: S.certificateListSchema } },
  },
  {
    method: 'post',
    path: '/api/v1/certificates',
    tag: 'Certificates',
    summary: 'Request a certificate',
    description:
      'Asynchronous: returns 202 immediately, DNS-01 takes one to three minutes. Send an Idempotency-Key — without it a client retry burns a Let\'s Encrypt order.',
    params: [
      {
        name: 'Idempotency-Key',
        in: 'header',
        schema: str,
        description: 'Strongly recommended.',
      },
    ],
    body: { schema: S.requests.createCertificate, required: true },
    responses: {
      202: { description: 'Queued', schema: S.certificateSchema },
      200: { description: 'Idempotent replay', schema: S.certificateSchema },
      403: problem('Missing cert:issue on the covering domain'),
      422: problem('No managed domain covers a SAN, or SANs span zones'),
    },
  },
  {
    method: 'get',
    path: '/api/v1/certificates/{id}',
    tag: 'Certificates',
    summary: 'Read one certificate',
    params: [idParam],
    responses: {
      200: { description: 'OK', schema: S.certificateSchema },
      404: problem('Not found'),
    },
  },
  {
    method: 'patch',
    path: '/api/v1/certificates/{id}',
    tag: 'Certificates',
    summary: 'Update the business metadata',
    description: 'The only mutable part of an issued certificate. Requires cert:issue.',
    params: [idParam],
    body: { schema: S.requests.updateMetadata, required: true },
    responses: {
      200: { description: 'Updated', schema: S.certificateSchema },
      422: problem('Invalid metadata'),
    },
  },
  {
    method: 'delete',
    path: '/api/v1/certificates/{id}',
    tag: 'Certificates',
    summary: 'Revoke, and optionally purge the row',
    description:
      'CA revocation and zone cleanup are best-effort: whatever is left behind comes back in warnings rather than blocking the delete.',
    params: [
      idParam,
      { name: 'purge', in: 'query', schema: bool, description: 'Also delete the row.' },
    ],
    responses: { 200: { description: 'Revoked', schema: S.deleteResultSchema } },
  },
  {
    method: 'post',
    path: '/api/v1/certificates/{id}/renew',
    tag: 'Certificates',
    summary: 'Re-queue the order now',
    params: [idParam],
    responses: {
      202: { description: 'Queued', schema: S.certificateSchema },
      409: problem('An issuance is already running, or the certificate is revoked'),
    },
  },
  {
    method: 'get',
    path: '/api/v1/certificates/{id}/bundle',
    tag: 'Certificates',
    summary: 'Download the certificate material',
    description:
      'Including `key` additionally requires the cert:export scope. Every export is audit-logged.',
    params: [
      idParam,
      { name: 'format', in: 'query', schema: z.enum(['json', 'pem']).default('json') },
      {
        name: 'include',
        in: 'query',
        schema: str.default('fullchain,key'),
        description: 'Comma-separated: fullchain, cert, chain, key.',
      },
    ],
    responses: {
      200: { description: 'Bundle', schema: S.bundleSchema },
      409: problem('Certificate is not issued'),
    },
  },
  {
    method: 'get',
    path: '/api/v1/certificates/{id}/events',
    tag: 'Certificates',
    summary: 'Order history, or a live SSE stream',
    params: [
      idParam,
      {
        name: 'stream',
        in: 'query',
        schema: z.enum(['1']),
        description: 'Switches the response to text/event-stream.',
      },
      { name: 'since', in: 'query', schema: str },
    ],
    responses: { 200: { description: 'History', schema: S.eventsSchema } },
  },

  {
    method: 'get',
    path: '/api/v1/subdomains/{fqdn}',
    tag: 'Subdomains',
    summary: 'Check whether a subdomain is already taken',
    description:
      'Reports both sources of truth, because they can disagree: a record may exist in the zone without local-cert knowing about it, and a certificate may exist here with nothing published.',
    params: [
      {
        name: 'fqdn',
        in: 'path',
        schema: str,
        required: true,
        example: 'nas.home.example.com',
      },
    ],
    responses: {
      200: { description: 'Lookup result', schema: S.subdomainLookupSchema },
      422: problem('Invalid FQDN, or no managed domain covers it'),
    },
  },

  {
    method: 'get',
    path: '/api/v1/dns/records',
    tag: 'DNS',
    summary: 'List records, annotated with provenance',
    params: [{ name: 'domain_id', in: 'query', schema: str }],
    responses: { 200: { description: 'OK', schema: S.dnsListSchema } },
  },
  {
    method: 'put',
    path: '/api/v1/dns/records',
    tag: 'DNS',
    summary: 'Upsert one record',
    body: { schema: S.requests.dnsRecord, required: true },
    responses: {
      200: { description: 'Applied', schema: S.dnsChangeSchema },
      403: problem('Missing dns:write, or an attempt to touch _acme-challenge'),
    },
  },
  {
    method: 'delete',
    path: '/api/v1/dns/records',
    tag: 'DNS',
    summary: 'Delete one record',
    params: [
      { name: 'fqdn', in: 'query', schema: str, required: true },
      { name: 'type', in: 'query', schema: z.enum(['A', 'AAAA', 'CNAME', 'TXT']), required: true },
      { name: 'values', in: 'query', schema: str, required: true, description: 'Comma-separated.' },
      { name: 'ttl', in: 'query', schema: int.default(60) },
    ],
    responses: { 200: { description: 'Deleted', schema: S.dnsChangeSchema } },
  },

  {
    method: 'get',
    path: '/api/v1/acme/account',
    tag: 'Ops',
    summary: 'ACME environment and account',
    description: 'Defaults to the production directory when APP_ENV=production, staging otherwise.',
    responses: { 200: { description: 'OK', schema: S.acmeAccountSchema } },
  },
  {
    method: 'get',
    path: '/api/v1/acme/eab',
    tag: 'ACME server',
    summary: 'List EAB credentials',
    description: 'A key sees its own credentials, an admin sees all of them.',
    responses: { 200: { description: 'OK', schema: S.acmeEabListSchema } },
  },
  {
    method: 'post',
    path: '/api/v1/acme/eab',
    tag: 'ACME server',
    summary: 'Create an EAB credential',
    description:
      'Returns the `kid` / HMAC key pair an ACME client (Traefik, certbot, Caddy, acme.sh…) registers with at `/acme/directory`. The resulting ACME account can order certificates for exactly what the bound API key may issue.',
    body: { schema: S.requests.createEab },
    responses: {
      201: { description: 'Created; hmac_key is shown once', schema: S.acmeEabCreatedSchema },
      403: problem('Binding another key requires admin'),
      404: problem('API key not found, revoked or expired'),
    },
  },
  {
    method: 'delete',
    path: '/api/v1/acme/eab/{id}',
    tag: 'ACME server',
    summary: 'Revoke an EAB credential',
    description: 'Also deactivates every ACME account registered with it.',
    params: [idParam],
    responses: {
      200: { description: 'Revoked', schema: S.acmeEabSchema },
      404: problem('Not found'),
    },
  },
  {
    method: 'get',
    path: '/api/openapi.json',
    tag: 'Ops',
    summary: 'This document',
    responses: { 200: { description: 'OpenAPI 3.1 document', schema: S.okSchema } },
  },

  {
    method: 'get',
    path: '/api/admin/session',
    tag: 'Admin',
    summary: 'Who am I',
    security: 'session',
    responses: {
      200: { description: 'OK', schema: S.sessionSchema },
      401: problem('Not signed in'),
    },
  },
  {
    method: 'post',
    path: '/api/admin/session',
    tag: 'Admin',
    summary: 'Sign in to the console',
    security: 'none',
    body: { schema: S.requests.login, required: true },
    responses: {
      200: { description: 'Signed in', schema: S.okSchema },
      401: problem('Invalid credentials'),
    },
  },
  {
    method: 'delete',
    path: '/api/admin/session',
    tag: 'Admin',
    summary: 'Sign out',
    security: 'session',
    responses: { 200: { description: 'Signed out', schema: S.okSchema } },
  },
  {
    method: 'get',
    path: '/api/admin/domains',
    tag: 'Admin',
    summary: 'List managed domains',
    security: 'session',
    responses: {
      200: { description: 'OK', schema: S.domainListSchema },
    },
  },
  {
    method: 'post',
    path: '/api/admin/domains',
    tag: 'Admin',
    summary: 'Register a Route53 zone',
    description:
      'Runs the full permission preflight first — the domain is only created if every required Route53 call is authorised. force=true registers anyway.',
    security: 'session',
    params: [{ name: 'force', in: 'query', schema: bool }],
    body: { schema: S.requests.createDomain, required: true },
    responses: {
      201: { description: 'Created, with the preflight report', schema: S.domainSchema },
      403: problem('Preflight failed — detail lists every check'),
      422: problem('The zone does not cover the declared name'),
    },
  },
  {
    method: 'delete',
    path: '/api/admin/domains/{id}',
    tag: 'Admin',
    summary: 'Remove a domain',
    description:
      'Any remaining certificate pins the domain. force=true revokes and removes them in one transaction.',
    security: 'session',
    params: [idParam, { name: 'force', in: 'query', schema: bool }],
    responses: {
      200: { description: 'Deleted', schema: S.deleteResultSchema },
      409: problem('Certificates still reference it'),
    },
  },
  {
    method: 'get',
    path: '/api/admin/keys',
    tag: 'Admin',
    summary: 'List API keys',
    security: 'session',
    responses: { 200: { description: 'OK', schema: S.apiKeyListSchema } },
  },
  {
    method: 'post',
    path: '/api/admin/keys',
    tag: 'Admin',
    summary: 'Mint an API key',
    description: 'The plaintext token is returned exactly once.',
    security: 'session',
    body: { schema: S.requests.createApiKey, required: true },
    responses: { 201: { description: 'Minted', schema: S.mintedKeySchema } },
  },
  {
    method: 'patch',
    path: '/api/admin/keys/{id}',
    tag: 'Admin',
    summary: 'Replace grants, rename, revoke or restore',
    security: 'session',
    params: [idParam],
    body: { schema: S.updateApiKeySchema },
    responses: { 200: { description: 'Updated', schema: S.okSchema } },
  },
  {
    method: 'delete',
    path: '/api/admin/keys/{id}',
    tag: 'Admin',
    summary: 'Delete an API key',
    security: 'session',
    params: [idParam],
    responses: {
      200: { description: 'Deleted', schema: S.okSchema },
      409: problem("It is your own account's key"),
    },
  },
  {
    method: 'get',
    path: '/api/admin/stats',
    tag: 'Admin',
    summary: 'Console dashboard counters',
    security: 'session',
    responses: { 200: { description: 'OK', schema: S.statsSchema } },
  },

  {
    method: 'post',
    path: '/api/mcp',
    tag: 'MCP',
    summary: 'Model Context Protocol (Streamable HTTP, JSON-RPC 2.0)',
    description:
      'Exposes the features of this API as MCP tools, with the same API key and the same ' +
      'scopes. Not meant to be called by hand: point an MCP client at this URL with an ' +
      'Authorization header. Admin tools are listed for admin keys only. The list_skills and ' +
      'get_skill tools return manuals describing every tool.',
    body: { schema: S.okSchema, required: true, description: 'A JSON-RPC 2.0 message' },
    responses: {
      200: { description: 'JSON-RPC response', schema: S.okSchema },
      202: { description: 'Notification accepted; no body' },
      400: { description: 'Body is not valid JSON-RPC', schema: S.okSchema },
      401: problem('Missing, invalid, revoked or expired key'),
    },
  },
];

import { z } from 'zod';
import {
  createApiKeySchema,
  createCertificateSchema,
  createDomainSchema,
  createEabSchema,
  dnsRecordSchema,
  loginSchema,
  metadataSchema,
  setupSchema,
  updateGrantsSchema,
  updateMetadataSchema,
} from '@/lib/validation';
import { ALL_SCOPES } from '@/lib/scopes';

/**
 * Every schema the OpenAPI document is generated from.
 *
 * Request schemas are the *same objects the handlers validate with*, imported
 * from validation.ts — they cannot drift. Response schemas are declared here
 * and tied to the runtime through `z.infer`, so a serializer that stops
 * matching its documented shape fails the type check.
 */
export const apiRegistry = z.registry<{ id: string; description?: string }>();

/** Registers a schema under an id so it lands in components/schemas as a $ref. */
function named<T extends z.ZodType>(id: string, schema: T, description?: string): T {
  apiRegistry.add(schema, { id, description });
  return schema;
}

/* ------------------------------------------------------------------ shared */

export const problemSchema = named(
  'Problem',
  z.object({
    type: z.enum([
      'unauthorized',
      'forbidden',
      'not_found',
      'conflict',
      'validation_error',
      'rate_limited',
      'setup_required',
      'upstream_error',
      'internal_error',
    ]),
    title: z.string(),
    status: z.int(),
    detail: z.unknown().optional(),
  }),
  'RFC 9457-style error body.',
);

export const metadataDoc = named(
  'Metadata',
  metadataSchema,
  'Caller-supplied business context. Strings only; at most 20 entries and 4096 bytes serialised.',
);

export const certificateStatusSchema = named(
  'CertificateStatus',
  z.enum([
    'pending',
    'dns_propagating',
    'validating',
    'issued',
    'failed',
    'revoked',
    'expired',
  ]),
);

export const certificateSchema = named(
  'Certificate',
  z.object({
    id: z.string(),
    status: certificateStatusSchema,
    domains: z.array(z.string()),
    managed_domain: z.string(),
    key_type: z.string(),
    serial: z.string().nullable(),
    issuer: z.string().nullable(),
    not_before: z.string().nullable(),
    not_after: z.string().nullable(),
    days_remaining: z.int().nullable(),
    fingerprint_sha256: z.string().nullable(),
    auto_renew: z.boolean(),
    renew_before_days: z.int(),
    dns_record: z.unknown().nullable(),
    metadata: metadataDoc,
    webhook_url: z.string().nullable(),
    last_error: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    links: z.object({ self: z.string(), bundle: z.string(), events: z.string() }),
  }),
);

/** The compile-time contract between serializeCert and the published schema. */
export type CertificateResource = z.infer<typeof certificateSchema>;

export const certificateListSchema = named(
  'CertificateList',
  z.object({ items: z.array(certificateSchema), total: z.int() }),
);

export const subdomainLookupSchema = named(
  'SubdomainLookup',
  z.object({
    fqdn: z.string(),
    available: z
      .boolean()
      .describe('True only when neither DNS nor local-cert knows the name and the zone was readable.'),
    managed_domain: z.string(),
    dns: z.object({
      exists: z.boolean(),
      managed: z.boolean().describe('A _local-cert provenance marker claims this name.'),
      records: z.array(
        z.object({
          type: z.string(),
          ttl: z.int().nullable(),
          values: z.array(z.string()),
        }),
      ),
      error: z.string().optional().describe('Present when the zone could not be read.'),
    }),
    certificate: z
      .object({
        id: z.string(),
        status: certificateStatusSchema,
        not_after: z.string().nullable(),
        days_remaining: z.int().nullable(),
        metadata: metadataDoc,
        links: z.record(z.string(), z.string()),
      })
      .nullable(),
    metadata: metadataDoc,
  }),
);

export const bundleSchema = named(
  'CertificateBundle',
  z.object({
    id: z.string(),
    domains: z.array(z.string()),
    not_after: z.string().nullable(),
    cert_pem: z.string().optional(),
    chain_pem: z.string().optional(),
    fullchain_pem: z.string().optional(),
    private_key_pem: z.string().optional().describe('Only with the cert:export scope.'),
  }),
);

export const eventsSchema = named(
  'CertificateEvents',
  z.object({
    id: z.string(),
    status: certificateStatusSchema,
    events: z.array(
      z.object({
        id: z.string(),
        certificate_id: z.string(),
        at: z.string(),
        level: z.enum(['info', 'warn', 'error']),
        step: z.string(),
        message: z.string(),
      }),
    ),
  }),
);

export const deleteResultSchema = named(
  'DeleteResult',
  z.object({
    id: z.string(),
    status: z.string().optional(),
    deleted: z.boolean().optional(),
    certificates_removed: z.int().optional(),
    warnings: z.array(z.string()).optional(),
  }),
);

/* -------------------------------------------------------------------- auth */

export const tokenResponseSchema = named(
  'AccessToken',
  z.object({
    access_token: z.string(),
    token_type: z.literal('Bearer'),
    expires_in: z.int(),
    expires_at: z.string(),
    scope: z.string(),
  }),
);

export const tokenRequestSchema = named(
  'AccessTokenRequest',
  z.object({ api_key: z.string().optional() }),
);

/* ------------------------------------------------------------------- setup */

export const passwordPolicySchema = named(
  'PasswordPolicy',
  z.object({
    enforced: z.boolean(),
    minLength: z.int(),
    maxLength: z.int(),
    requiredClasses: z.int(),
    rejectCommon: z.boolean(),
    rejectEmailSimilarity: z.boolean(),
    description: z.string(),
  }),
);

export const setupStatusSchema = named(
  'SetupStatus',
  z.object({
    setup_required: z.boolean(),
    environment: z.enum(['production', 'development']),
    password_policy: passwordPolicySchema,
  }),
);

export const setupResultSchema = named(
  'SetupResult',
  z.object({
    email: z.string(),
    api_key: z.string().describe('Shown exactly once.'),
    api_key_minted: z.boolean(),
  }),
);

/* ------------------------------------------------------------------- admin */

export const sessionSchema = named(
  'Session',
  z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(['key', 'user']),
    is_admin: z.boolean(),
  }),
);

export const preflightCheckSchema = named(
  'PreflightCheck',
  z.object({
    id: z.string(),
    label: z.string(),
    required: z.boolean(),
    ok: z.boolean(),
    note: z.string(),
    why: z.string().optional(),
  }),
);

export const domainSchema = named(
  'Domain',
  z.object({
    id: z.string(),
    name: z.string(),
    route53_zone_id: z.string(),
    aws_role_arn: z.string().nullable(),
    aws_region: z.string(),
    default_ttl: z.int(),
    created_at: z.string(),
    certificate_count: z.int().optional(),
    preflight: z.array(preflightCheckSchema).optional(),
    warnings: z.array(z.string()).optional(),
  }),
);

export const apiKeySchema = named(
  'ApiKey',
  z.object({
    id: z.string(),
    name: z.string(),
    prefix: z.string(),
    user_id: z.string().nullable(),
    opaque: z.boolean(),
    is_admin: z.boolean(),
    global_scopes: z.array(z.enum(ALL_SCOPES as [string, ...string[]])),
    created_at: z.string(),
    expires_at: z.string().nullable(),
    last_used_at: z.string().nullable(),
    revoked_at: z.string().nullable(),
    grants: z.array(
      z.object({ domain_id: z.string(), domain: z.string(), scopes: z.array(z.string()) }),
    ),
  }),
);

export const mintedKeySchema = named(
  'MintedApiKey',
  z.object({
    id: z.string(),
    name: z.string(),
    prefix: z.string(),
    is_admin: z.boolean(),
    token: z.string().describe('Shown exactly once.'),
  }),
);

export const healthSchema = named(
  'Health',
  z.object({
    status: z.literal('ok'),
    dialect: z.enum(['sqlite', 'postgres']),
    at: z.string(),
  }),
);

export const acmeAccountSchema = named(
  'AcmeAccount',
  z.object({
    environment: z.enum(['staging', 'production']),
    directory_url: z.string(),
    contact: z.string(),
    account_url: z.string().nullable(),
  }),
);

const acmeEabFields = {
  id: z.string().meta({ description: 'The EAB key id (`kid`).', example: 'eab_3q2-7wEBAQEBAQEB' }),
  api_key_id: z.string(),
  created_at: z.string(),
  last_used_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  accounts: z.int().meta({ description: 'Active ACME accounts registered with this credential.' }),
};

export const acmeEabSchema = named(
  'AcmeEabKey',
  z.object(acmeEabFields),
  'External Account Binding credential: ACME accounts registered with it act as the API key.',
);
export type AcmeEabResource = z.infer<typeof acmeEabSchema>;

export const acmeEabCreatedSchema = named(
  'AcmeEabKeyCreated',
  z.object({
    ...acmeEabFields,
    hmac_key: z.string().meta({ description: 'Base64url HMAC key. Shown once.' }),
    directory_url: z.string().meta({ description: 'ACME directory to point the client at.' }),
  }),
);
export type AcmeEabCreated = z.infer<typeof acmeEabCreatedSchema>;

export const acmeEabListSchema = named('AcmeEabKeyList', z.object({ items: z.array(acmeEabSchema) }));

export const dnsListSchema = named(
  'DnsRecordList',
  z.object({
    items: z.array(
      z.object({
        domain_id: z.string(),
        domain: z.string(),
        records: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            ttl: z.int().nullable(),
            values: z.array(z.string()),
            managed: z.boolean(),
            marker: z.boolean(),
          }),
        ),
      }),
    ),
  }),
);

export const dnsChangeSchema = named(
  'DnsChangeResult',
  z.object({
    fqdn: z.string(),
    type: z.string(),
    values: z.array(z.string()).optional(),
    ttl: z.int().optional(),
    change_id: z.string().optional(),
    deleted: z.boolean().optional(),
  }),
);

export const statsSchema = named(
  'Stats',
  z.object({
    certificates: z.record(z.string(), z.int()),
    expiring_30d: z.int(),
    domains: z.int(),
    active_keys: z.int(),
    dialect: z.string(),
    acme: z.unknown(),
    recent_audit: z.array(z.unknown()),
  }),
);

export const okSchema = named('Ok', z.object({}).loose());

export const domainListSchema = named(
  'DomainList',
  z.object({ items: z.array(domainSchema) }),
);

export const apiKeyListSchema = named(
  'ApiKeyList',
  z.object({ items: z.array(apiKeySchema) }),
);

export const updateApiKeySchema = named(
  'UpdateApiKeyRequest',
  z.object({
    name: z.string().optional(),
    revoked: z.boolean().optional(),
    grants: updateGrantsSchema.shape.grants.optional(),
  }),
);

/* Request schemas re-exported under stable ids so they appear as components. */
export const requests = {
  createCertificate: named('CreateCertificateRequest', createCertificateSchema),
  updateMetadata: named('UpdateMetadataRequest', updateMetadataSchema),
  dnsRecord: named('DnsRecordRequest', dnsRecordSchema),
  createDomain: named('CreateDomainRequest', createDomainSchema),
  createApiKey: named('CreateApiKeyRequest', createApiKeySchema),
  updateGrants: named('UpdateGrantsRequest', updateGrantsSchema),
  login: named('LoginRequest', loginSchema),
  setup: named('SetupRequest', setupSchema),
  createEab: named('CreateAcmeEabRequest', createEabSchema),
  token: tokenRequestSchema,
};

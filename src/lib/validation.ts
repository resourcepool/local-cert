import { z } from 'zod';
import { DOMAIN_SCOPES } from './scopes';
import { PROVIDER_TYPES } from '@/lib/dns/provider-types';

/** Certificate subjects: real hostnames only, optional leading wildcard. */
const HOSTNAME = /^(?=.{1,253}$)(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** DNS record names: same, but underscore labels (_dmarc, _acme-challenge) are legal. */
const DNS_NAME = /^(?=.{1,253}$)(\*\.)?([_a-z0-9]([_a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export const fqdnSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HOSTNAME, 'Not a valid FQDN (wildcards allowed only as a leading "*.")')
  // Examples live on the schema so the generated OpenAPI document inherits
  // them; there is no second place to keep in sync.
  .meta({ example: 'nas.home.example.com' });

export const ipv4Schema = z
  .string()
  .trim()
  .regex(
    /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
    'Not a valid IPv4 address',
  )
  .meta({ example: '192.168.1.50' });

export const keyTypeSchema = z.enum(['ec-256', 'ec-384', 'rsa-2048', 'rsa-4096']);

/**
 * Free-form business context supplied by the calling system (tenant id, env,
 * ticket ref…). Strings only, and bounded — this is an index-free TEXT column,
 * not a document store.
 */
export const METADATA_LIMITS = {
  maxKeys: 20,
  maxKeyLength: 64,
  maxValueLength: 512,
  maxBytes: 4096,
} as const;

const METADATA_KEY = /^[A-Za-z0-9._:-]+$/;

export const metadataSchema = z
  .record(z.string(), z.string().max(METADATA_LIMITS.maxValueLength))
  // Keys are validated here rather than with a key schema: zod reports a bare
  // "Invalid key in record" for those, which tells an integrator nothing.
  .superRefine((v, ctx) => {
    const bad = Object.keys(v).filter(
      (k) => !METADATA_KEY.test(k) || k.length > METADATA_LIMITS.maxKeyLength,
    );
    if (bad.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message:
          `Invalid metadata key(s): ${bad.join(', ')}. ` +
          `Use letters, digits and . _ : - , at most ${METADATA_LIMITS.maxKeyLength} characters.`,
      });
    }
  })
  .refine((v) => Object.keys(v).length <= METADATA_LIMITS.maxKeys, {
    message: `At most ${METADATA_LIMITS.maxKeys} metadata entries`,
  })
  .refine((v) => JSON.stringify(v).length <= METADATA_LIMITS.maxBytes, {
    message: `Metadata must serialise to at most ${METADATA_LIMITS.maxBytes} bytes`,
  })
  .meta({ example: { tenant_id: 'acme-corp', env: 'prod', ticket: 'OPS-1421' } });

export const updateMetadataSchema = z.object({
  metadata: metadataSchema,
  /** merge into the existing map (default) or replace it wholesale */
  mode: z.enum(['merge', 'replace']).default('merge'),
});

export const createCertificateSchema = z.object({
  domains: z.array(fqdnSchema).min(1).max(100),
  key_type: keyTypeSchema.default('ec-256'),
  auto_renew: z.boolean().default(true),
  renew_before_days: z.number().int().min(1).max(89).default(30),
  webhook_url: z.url().optional(),
  metadata: metadataSchema.default({}),
  dns: z
    .object({
      create_record: z.boolean().default(false),
      target_ip: ipv4Schema.optional(),
      ttl: z.number().int().min(30).max(86400).default(60),
    })
    .optional(),
});

export const dnsNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(DNS_NAME, 'Not a valid DNS name');

export const dnsRecordSchema = z.object({
  fqdn: dnsNameSchema,
  type: z.enum(['A', 'AAAA', 'CNAME', 'TXT']),
  values: z.array(z.string().min(1)).min(1),
  ttl: z.number().int().min(30).max(86400).default(60),
});

export const createDomainSchema = z.object({
  name: fqdnSchema.meta({ example: 'home.example.com' }),
  route53_zone_id: z
    .string()
    .trim()
    .min(1)
    .transform((v) => v.replace(/^\/hostedzone\//, ''))
    .meta({
      example: 'Z0123456ABCDEFGHIJK',
      description:
        'Zone identifier at the DNS host: the hosted zone id for Route53, the managed zone name for Google Cloud DNS, the domain name for OVHcloud, Gandi and GoDaddy. The field keeps its historical name.',
    }),
  aws_region: z.string().trim().default('us-east-1'),
  aws_role_arn: z.string().trim().startsWith('arn:aws:iam::').nullish(),
  default_ttl: z.number().int().min(30).max(86400).default(60),
  provider_id: z
    .string()
    .min(1)
    .nullish()
    .meta({
      description:
        'DNS provider holding the credentials for this zone. When set, aws_region and aws_role_arn come from the provider. Omitted: the ambient AWS credential chain is used.',
    }),
});

const awsAccessKeyId = z
  .string()
  .trim()
  .regex(/^[A-Z0-9]{16,128}$/, 'Not an AWS access key id');
const awsRoleArn = z
  .string()
  .trim()
  .regex(/^arn:aws[a-z-]*:iam::\d{12}:role\/[\w+=,.@/-]+$/, 'Not an IAM role ARN');
const providerName = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ._()-]*$/, 'Letters, digits, spaces and . _ - ( ) only')
  .meta({ example: 'aws-prod' });

/**
 * Fields of a non-AWS host (OVH, Gandi, GoDaddy, Google Cloud), keyed as in
 * lib/dns/provider-types.ts; checked against that registry by the service.
 */
const remoteSettings = z
  .record(z.string(), z.string())
  .optional()
  .meta({
    description:
      'Non-AWS providers: their credential fields, e.g. {"token": "…"} for Gandi or {"endpoint": "ovh-eu", "application_key": "…", "application_secret": "…", "consumer_key": "…"} for OVH. Secret fields are stored encrypted and never returned.',
  });

const awsCredentialFields = {
  access_key_id: awsAccessKeyId.nullish().meta({
    description: 'IAM user access key. Omit both key fields to use the ambient credential chain.',
  }),
  secret_access_key: z.string().trim().min(1).nullish(),
  role_arn: awsRoleArn.nullish().meta({
    description: 'Role assumed for every Route53 call. Omitted: the IAM user is used directly.',
  }),
};

const keyPairComplete = (v: { access_key_id?: string | null; secret_access_key?: string | null }) =>
  Boolean(v.access_key_id) === Boolean(v.secret_access_key);
const keyPairMessage = {
  message: 'access_key_id and secret_access_key go together',
  path: ['secret_access_key'],
};

export const createProviderSchema = z
  .object({
    name: providerName,
    type: z.enum(PROVIDER_TYPES).default('aws'),
    ...awsCredentialFields,
    settings: remoteSettings,
    region: z.string().trim().min(1).default('us-east-1'),
    draft: z.boolean().default(false).meta({
      description:
        'Store an unfinished provider: only the key pair has to be valid. Domains cannot use it until it is finalised with PATCH draft=false.',
    }),
  })
  .refine(keyPairComplete, keyPairMessage);

/** Absent field = unchanged. role_arn: null drops the role. */
export const updateProviderSchema = z
  .object({
    name: providerName.optional(),
    access_key_id: awsAccessKeyId.optional(),
    secret_access_key: z.string().trim().min(1).optional(),
    role_arn: awsRoleArn.nullable().optional(),
    region: z.string().trim().min(1).optional(),
    settings: remoteSettings,
    draft: z.literal(false).optional().meta({
      description: 'Finalises a draft. Refused while the connection test fails, unless force=true.',
    }),
  })
  .refine(keyPairComplete, keyPairMessage);

/**
 * Tests credentials without storing them. With provider_id and no key pair,
 * the stored key pair is used — that is how a new role ARN is tried against
 * an existing provider.
 */
export const probeProviderSchema = z
  .object({
    provider_id: z.string().min(1).nullish(),
    type: z.enum(PROVIDER_TYPES).optional(),
    ...awsCredentialFields,
    settings: remoteSettings,
    region: z.string().trim().min(1).default('us-east-1'),
  })
  .refine(keyPairComplete, keyPairMessage);

const scopeEnum = z.enum(DOMAIN_SCOPES as [string, ...string[]]);

export const createEabSchema = z.object({
  name: z.string().trim().min(1).max(80),
  expires_at: z.iso.datetime().nullish(),
  domain_ids: z
    .array(z.string().min(1))
    .min(1)
    .meta({ description: 'Managed domains the ACME client may request certificates under.' }),
});

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  is_admin: z.boolean().default(false),
  expires_at: z.iso.datetime().nullish(),
  grants: z
    .array(
      z.object({
        domain_id: z.string().min(1),
        scopes: z.array(scopeEnum).min(1),
      }),
    )
    .default([]),
});

export const updateGrantsSchema = z.object({
  grants: z.array(
    z.object({
      domain_id: z.string().min(1),
      scopes: z.array(scopeEnum),
    }),
  ),
});

/** Emails are stored and compared lowercased, so normalise at the edge. */
const emailSchema = z.email().trim().toLowerCase();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const setupSchema = z
  .object({
    email: emailSchema,
    // No length or composition policy by design — only non-empty.
    password: z.string().min(1, 'Password required'),
    password_confirm: z.string(),
    api_key: z.string().trim().min(24).optional(),
  })
  .refine((v) => v.password === v.password_confirm, {
    message: 'Passwords do not match',
    path: ['password_confirm'],
  });

/** `nas.home.example.com` and `*.home.example.com` both belong to `home.example.com`. */
export function belongsToDomain(fqdn: string, domainName: string): boolean {
  const bare = fqdn.startsWith('*.') ? fqdn.slice(2) : fqdn;
  return bare === domainName || bare.endsWith(`.${domainName}`);
}

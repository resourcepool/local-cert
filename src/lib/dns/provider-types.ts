/**
 * The DNS hosts local-cert can drive, and what each needs to be configured.
 *
 * Pure data, importable from client code: the console builds its forms from
 * it, the server validates against it, and the environment loader derives the
 * PROVIDER_<TYPE>_<KEY>_<FIELD> variable names from it. Adding a host is one
 * entry here plus a driver in lib/dns/drivers.
 *
 * Labels here are the English reference; the console looks translations up in
 * the `common.providerText` messages (see lib/i18n/provider-text.ts).
 *
 * AWS is listed for its label only — its fields are the richer, older set
 * (key pair + optional role) handled by name in lib/dns/providers.ts.
 */

export const PROVIDER_TYPES = ['aws', 'ovh', 'gandi', 'godaddy', 'gcp'] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];
export type RemoteProviderType = Exclude<ProviderType, 'aws'>;

export interface ProviderField {
  /** config key; upper-cased, it is also the environment variable suffix */
  key: string;
  label: string;
  /** stored encrypted, never returned */
  secret: boolean;
  required: boolean;
  hint?: string;
  placeholder?: string;
  /** closed list of values */
  options?: Array<{ value: string; label: string }>;
  multiline?: boolean;
}

export interface ProviderTypeInfo {
  type: ProviderType;
  label: string;
  /** what the host calls its DNS product */
  product: string;
  /** slug of the guide under /admin/docs */
  docs: string;
  /** smallest TTL the host accepts, in seconds */
  minTtl: number;
  fields: ProviderField[];
}

export const PROVIDER_INFO: Record<ProviderType, ProviderTypeInfo> = {
  aws: {
    type: 'aws',
    label: 'AWS',
    product: 'Route53',
    docs: 'providers/aws',
    minTtl: 30,
    fields: [],
  },
  ovh: {
    type: 'ovh',
    label: 'OVHcloud',
    product: 'OVHcloud DNS zones',
    docs: 'providers/ovh',
    minTtl: 60,
    fields: [
      {
        key: 'endpoint',
        label: 'API region',
        secret: false,
        required: true,
        options: [
          { value: 'ovh-eu', label: 'Europe (eu.api.ovh.com)' },
          { value: 'ovh-ca', label: 'Canada (ca.api.ovh.com)' },
          { value: 'ovh-us', label: 'United States (api.us.ovhcloud.com)' },
        ],
      },
      { key: 'application_key', label: 'Application key', secret: false, required: true },
      { key: 'application_secret', label: 'Application secret', secret: true, required: true },
      { key: 'consumer_key', label: 'Consumer key', secret: true, required: true },
    ],
  },
  gandi: {
    type: 'gandi',
    label: 'Gandi',
    product: 'LiveDNS',
    docs: 'providers/gandi',
    minTtl: 300,
    fields: [
      {
        key: 'token',
        label: 'Personal Access Token',
        secret: true,
        required: true,
        hint: '“Manage domain name technical configurations” permission',
      },
    ],
  },
  godaddy: {
    type: 'godaddy',
    label: 'GoDaddy',
    product: 'GoDaddy DNS',
    docs: 'providers/godaddy',
    minTtl: 600,
    fields: [
      { key: 'api_key', label: 'API key', secret: false, required: true },
      { key: 'api_secret', label: 'API secret', secret: true, required: true },
    ],
  },
  gcp: {
    type: 'gcp',
    label: 'Google Cloud',
    product: 'Cloud DNS',
    docs: 'providers/gcp',
    minTtl: 1,
    fields: [
      {
        key: 'service_account_json',
        label: 'Service account key (JSON)',
        secret: true,
        required: true,
        multiline: true,
        placeholder: '{ "type": "service_account", "project_id": "…", … }',
        hint: 'the full content of the downloaded .json file',
      },
      {
        key: 'project_id',
        label: 'Project ID',
        secret: false,
        required: false,
        hint: 'optional: defaults to the one in the key',
      },
    ],
  },
};

export const isProviderType = (v: unknown): v is ProviderType =>
  typeof v === 'string' && (PROVIDER_TYPES as readonly string[]).includes(v);

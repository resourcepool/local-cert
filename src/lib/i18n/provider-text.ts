import type { ProviderField, ProviderType, ProviderTypeInfo } from '@/lib/dns/provider-types';
import type { Messages } from './messages';

type Text = Messages['common']['providerText'];

const PRODUCT: Partial<Record<ProviderType, keyof Text>> = {
  ovh: 'ovhProduct',
  godaddy: 'godaddyProduct',
};
const LABEL: Record<string, keyof Text> = {
  'ovh.endpoint': 'ovhEndpoint',
  'gcp.service_account_json': 'gcpKey',
  'gcp.project_id': 'gcpProject',
};
const HINT: Record<string, keyof Text> = {
  'gandi.token': 'gandiTokenHint',
  'gcp.service_account_json': 'gcpKeyHint',
  'gcp.project_id': 'gcpProjectHint',
};
const OPTION: Record<string, keyof Text> = { 'ovh.endpoint.ovh-us': 'ovhEndpointUs' };

/**
 * provider-types.ts is plain data shared with the server, so it carries the
 * English wording only; this returns the same description in the reader's
 * language. Most labels are the host's own terms and stay as they are.
 */
export function localizeProvider(t: Messages, info: ProviderTypeInfo): ProviderTypeInfo {
  const text = t.common.providerText;
  const pick = (key: keyof Text | undefined, fallback: string | undefined) =>
    key ? text[key] : fallback;
  return {
    ...info,
    product: pick(PRODUCT[info.type], info.product) as string,
    fields: info.fields.map((f): ProviderField => {
      const id = `${info.type}.${f.key}`;
      return {
        ...f,
        label: pick(LABEL[id], f.label) as string,
        hint: pick(HINT[id], f.hint),
        options: f.options?.map((o) => ({
          ...o,
          label: pick(OPTION[`${id}.${o.value}`], o.label) as string,
        })),
      };
    }),
  };
}

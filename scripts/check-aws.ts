/**
 * Route53 permission preflight — same checks the admin console runs when a
 * domain is registered.
 *
 *   npm run aws:check -- <hosted-zone-id> [provider-key]
 *
 * provider-key is the <KEY> of a PROVIDER_AWS_<KEY>_* declaration (DEFAULT when
 * omitted). Without such a declaration the process credential chain is used.
 * Probes every call local-cert makes. Write access is tested with a DELETE of a
 * record that cannot exist, so the zone is never modified.
 */
import { preflightZone } from '../src/lib/dns/preflight';
import { declaredProviders } from '../src/lib/dns/env-providers';

const [zoneId, providerKey = 'DEFAULT'] = process.argv.slice(2);
if (!zoneId) {
  console.error('usage: npm run aws:check -- <hosted-zone-id> [provider-key]');
  process.exit(1);
}

const provider =
  declaredProviders().find((p) => p.type === 'aws' && p.key === providerKey.toUpperCase()) ?? null;
const region = provider?.region ?? process.env.AWS_REGION ?? 'us-east-1';
const result = await preflightZone({
  zoneId,
  region,
  roleArn: provider?.roleArn ?? null,
  auth:
    provider?.accessKeyId && provider.secretAccessKey
      ? { accessKeyId: provider.accessKeyId, secretAccessKey: provider.secretAccessKey }
      : null,
});

console.log(
  `\nprovider: ${provider ? `${provider.name} (PROVIDER_AWS_${provider.key}_*)` : 'process credentials'}`,
);
console.log(`\nzone ${zoneId} (${region})${result.zoneName ? ` — ${result.zoneName}` : ''}\n`);
for (const c of result.checks) {
  const status = c.ok ? 'OK    ' : c.required ? 'DENIED' : 'denied';
  const why = c.ok ? '' : `${c.required ? 'REQUIRED — ' : 'optional — '}${c.why ?? c.note}`;
  console.log(`  ${status}  ${c.label.padEnd(32)} ${why}`);
}
console.log(
  result.ok
    ? '\nAll required permissions are present.\n'
    : `\n${result.failures.length} required permission(s) missing — see docs/iam-policy.json.\n`,
);
process.exit(result.ok ? 0 : 1);

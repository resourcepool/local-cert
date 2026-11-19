import 'server-only';
import { deleteRecord } from './zone';
import { zoneFor } from './providers';
import { logEvent } from '@/lib/acme/issue';
import type { CertificatesTable, DomainsTable } from '@/lib/db/types';

/**
 * Removes the records a certificate owns, never throwing.
 *
 * Deletion must stay possible when the zone has become unreachable — a revoked
 * IAM role, a deleted hosted zone, an expired assumed role. Blocking the DB
 * cleanup on a Route53 failure strands the row forever, and a stranded
 * certificate row also pins its domain via the foreign key.
 *
 * Returns human-readable warnings so the caller can tell the operator exactly
 * what is left behind in the zone.
 */
export async function cleanupCertificateRecords(
  cert: Pick<CertificatesTable, 'id' | 'domains' | 'dns_record'>,
  domain: Pick<DomainsTable, 'route53_zone_id' | 'aws_region' | 'aws_role_arn' | 'provider_id' | 'default_ttl'
  >,
): Promise<string[]> {
  const dnsRecord = cert.dns_record ? JSON.parse(cert.dns_record) : null;
  if (!dnsRecord?.create_record || !dnsRecord.target_ip) return [];

  const names: string[] = JSON.parse(cert.domains);
  const target = names.find((n) => !n.startsWith('*.'));
  if (!target) return [];

  try {
    await deleteRecord(
      await zoneFor(domain),
      target,
      'A',
      [dnsRecord.target_ip],
      dnsRecord.ttl ?? domain.default_ttl,
    );
    return [];
  } catch (err) {
    const warning =
      `Could not remove A ${target} -> ${dnsRecord.target_ip} from Route53: ` +
      `${(err as Error).message}. The record is still published — delete it by hand.`;
    await logEvent(cert.id, 'dns.cleanup', warning, 'warn').catch(() => {});
    return [warning];
  }
}

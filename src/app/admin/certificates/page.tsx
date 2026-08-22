import { db } from '@/lib/db';
import { serializeCert } from '@/lib/certificates';
import { CertificatesClient } from './certificates-client';

export const dynamic = 'force-dynamic';

export default async function CertificatesPage() {
  const [rows, domains] = await Promise.all([
    db().selectFrom('certificates').selectAll().orderBy('created_at', 'desc').execute(),
    db().selectFrom('domains').select(['id', 'name', 'default_ttl']).orderBy('name').execute(),
  ]);
  const names = new Map(domains.map((d) => [d.id, d.name]));

  return (
    <CertificatesClient
      domains={domains}
      certificates={rows.map((r) => serializeCert(r, names.get(r.domain_id) ?? '?'))}
    />
  );
}

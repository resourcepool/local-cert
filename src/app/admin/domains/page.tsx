import { db } from '@/lib/db';
import { DomainsClient } from './domains-client';

export const dynamic = 'force-dynamic';

export default async function DomainsPage() {
  const domains = await db().selectFrom('domains').selectAll().orderBy('name').execute();
  const counts = await db()
    .selectFrom('certificates')
    .select(['domain_id', (eb) => eb.fn.countAll<number>().as('n')])
    .groupBy('domain_id')
    .execute();
  const byDomain = new Map(counts.map((c) => [c.domain_id, Number(c.n)]));

  return (
    <DomainsClient
      initial={domains.map((d) => ({ ...d, certificate_count: byDomain.get(d.id) ?? 0 }))}
    />
  );
}

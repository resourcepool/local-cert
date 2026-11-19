import { requireAdminSession } from '@/lib/auth/guard';
import { listDomainsWithCounts } from '@/lib/admin/domains';
import { listProviders } from '@/lib/dns/providers';
import { DomainsClient } from './domains-client';

export const dynamic = 'force-dynamic';

export default async function DomainsPage() {
  await requireAdminSession();
  const [{ items: domains }, { items: providers }] = await Promise.all([
    listDomainsWithCounts(),
    listProviders(),
  ]);

  return (
    <DomainsClient
      initial={domains}
      providers={providers
        .filter((p) => !p.draft)
        .map((p) => ({ id: p.id, name: p.name, type: p.type, role_arn: p.role_arn }))}
    />
  );
}

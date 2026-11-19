import { requireAdminSession } from '@/lib/auth/guard';
import { listProviders } from '@/lib/dns/providers';
import { ProvidersClient } from './providers-client';

export const dynamic = 'force-dynamic';

export default async function ProvidersPage() {
  await requireAdminSession();
  const { items } = await listProviders();
  return <ProvidersClient initial={items} />;
}

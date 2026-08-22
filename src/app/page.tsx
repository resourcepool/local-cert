import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/guard';
import { ensureReady, isSetupComplete } from '@/lib/auth/setup';

export const dynamic = 'force-dynamic';

export default async function Home() {
  await ensureReady();
  if (!(await isSetupComplete())) redirect('/setup');
  redirect((await getAdminSession()) ? '/admin' : '/login');
}

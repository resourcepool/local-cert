import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/guard';
import { ensureReady, isSetupComplete } from '@/lib/auth/setup';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  await ensureReady();
  if (!(await isSetupComplete())) redirect('/setup');
  if (await getAdminSession()) redirect('/admin');

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-lg tracking-tight text-ink-100">
            local<span className="text-accent">-</span>cert
          </h1>
          <p className="mt-1 text-xs text-ink-400">
            Certificats Let&apos;s Encrypt pour hôtes LAN · DNS-01 / Route53
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

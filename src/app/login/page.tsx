import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/guard';
import { ensureReady, isSetupComplete } from '@/lib/auth/setup';
import { LoginForm } from './login-form';
import { Logo } from '@/components/logo';
import { LanguageSelect } from '@/components/language-select';
import { getMessages } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  await ensureReady();
  if (!(await isSetupComplete())) redirect('/setup');
  if (await getAdminSession()) redirect('/admin');

  const t = await getMessages();
  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <LanguageSelect className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-xl">
            <Logo size={30} />
          </h1>
          <p className="mt-2 text-sm text-ink-400">
            {t.auth.tagline}
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

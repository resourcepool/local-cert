import { redirect } from 'next/navigation';
import { ensureReady, isSetupComplete } from '@/lib/auth/setup';
import { appEnv } from '@/lib/env';
import { SetupForm } from './setup-form';
import { Logo } from '@/components/logo';
import { LanguageSelect } from '@/components/language-select';
import { getMessages } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  await ensureReady();
  if (await isSetupComplete()) redirect('/login');

  const t = await getMessages();
  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <LanguageSelect className="absolute right-4 top-4" />
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-xl">
            <Logo size={30} />
          </h1>
          <p className="mt-2 text-sm text-ink-400">
            {t.auth.setup.intro}
          </p>
          <span
            className={`mt-2 inline-block rounded border px-1.5 py-0.5 text-[11px] ${
              appEnv() === 'production'
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-warn/40 bg-warn/10 text-warn'
            }`}
          >
            env:{appEnv()}
          </span>
        </div>
        <SetupForm />
      </div>
    </main>
  );
}

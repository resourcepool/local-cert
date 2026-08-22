import { redirect } from 'next/navigation';
import { ensureReady, isSetupComplete } from '@/lib/auth/setup';
import { appEnv } from '@/lib/env';
import { SetupForm } from './setup-form';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  await ensureReady();
  if (await isSetupComplete()) redirect('/login');

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-lg tracking-tight text-ink-100">
            local<span className="text-accent">-</span>cert
          </h1>
          <p className="mt-1 text-xs text-ink-400">
            Première configuration · création du compte administrateur
          </p>
          <span
            className={`mt-2 inline-block rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
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

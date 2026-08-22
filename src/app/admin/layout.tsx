import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/guard';
import { ensureReady, isSetupComplete } from '@/lib/auth/setup';
import { DIALECT } from '@/lib/db';
import { acmeEnv } from '@/lib/acme/client';
import { appEnv } from '@/lib/env';
import { SignOut } from './sign-out';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: 'Vue d’ensemble' },
  { href: '/admin/certificates', label: 'Certificats' },
  { href: '/admin/domains', label: 'Domaines' },
  { href: '/admin/keys', label: 'Clés & droits' },
  { href: '/admin/api', label: 'API' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureReady();
  if (!(await isSetupComplete())) redirect('/setup');
  const session = await getAdminSession();
  if (!session) redirect('/login');

  const env = acmeEnv();

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-ink-700 py-4">
        <Link href="/admin" className="text-sm tracking-tight">
          local<span className="text-accent">-</span>cert
        </Link>
        <nav className="flex flex-wrap gap-4 text-xs">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-ink-400 transition-colors hover:text-ink-100">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[10px] uppercase tracking-wider">
          <span
            className={`rounded border px-1.5 py-0.5 ${
              env === 'production'
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-warn/40 bg-warn/10 text-warn'
            }`}
          >
            acme:{env}
          </span>
          <span
            className={`rounded border px-1.5 py-0.5 ${
              appEnv() === 'production'
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-ink-600 text-ink-400'
            }`}
          >
            env:{appEnv()}
          </span>
          <span className="rounded border border-ink-600 px-1.5 py-0.5 text-ink-400">db:{DIALECT}</span>
          <span className="text-ink-400 normal-case tracking-normal">{session.name}</span>
          <SignOut />
        </div>
      </header>
      <main className="flex-1 py-6">{children}</main>
      <footer className="border-t border-ink-700 py-4 text-[11px] text-ink-600">
        API : <code>/api/v1</code> · santé : <code>/api/healthz</code>
      </footer>
    </div>
  );
}

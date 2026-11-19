import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/guard';
import { ensureReady, isSetupComplete } from '@/lib/auth/setup';
import { acmeEnv } from '@/lib/acme/client';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Footer } from '@/components/footer';
import { getMessages } from '@/lib/i18n/server';
import { NavLinks } from './nav-links';
import { SettingsMenu } from './settings-menu';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureReady();
  if (!(await isSetupComplete())) redirect('/setup');
  const session = await getAdminSession();
  if (!session) redirect('/login');

  const env = acmeEnv();
  const t = (await getMessages()).shell;
  const nav = [
    { href: '/admin', label: t.nav.overview },
    { href: '/admin/certificates', label: t.nav.certificates },
    { href: '/admin/domains', label: t.nav.domains },
  ];

  const chip = 'rounded-md border px-1.5 py-0.5 text-[11px]';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5">
          <Link href="/admin" aria-label={t.homeLabel} className="text-[15px]">
            <Logo />
          </Link>
          <NavLinks items={nav} />
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <span
              title={t.acmeChipTitle}
              className={`${chip} ${
                env === 'production'
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-warn/40 bg-warn/10 text-warn'
              }`}
            >
              ACME {env}
            </span>
            <ThemeToggle />
            <SettingsMenu user={session.name} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7">{children}</main>
      <Footer />
    </div>
  );
}

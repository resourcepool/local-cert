import Link from 'next/link';
import pkg from '../../package.json';
import { fmt } from '@/lib/i18n/format';
import { getMessages } from '@/lib/i18n/server';
import { Logo } from './logo';

/** The console's site map, with who publishes it and which build is running. */
export async function Footer() {
  const t = await getMessages();
  const f = t.shell.footer;
  const columns = [
    {
      title: f.console,
      links: [
        { href: '/admin', label: t.shell.nav.overview },
        { href: '/admin/certificates', label: t.shell.nav.certificates },
        { href: '/admin/domains', label: t.shell.nav.domains },
      ],
    },
    {
      title: f.configuration,
      links: [
        { href: '/admin/providers', label: t.shell.settings.providers },
        { href: '/admin/keys', label: t.shell.settings.keys },
      ],
    },
    {
      title: f.reference,
      links: [
        { href: '/admin/api', label: t.shell.settings.api },
        { href: '/admin/docs', label: t.shell.settings.docs },
      ],
    },
    {
      title: f.guides,
      links: [
        { href: '/admin/docs', label: f.quickstart },
        { href: '/admin/docs/domains', label: f.addDomain },
        { href: '/admin/docs/providers', label: f.dnsProviders },
        { href: '/admin/docs/acme', label: f.acmeServer },
      ],
    },
  ];

  return (
    <footer className="mt-10 border-t border-ink-700">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <nav
          aria-label={f.aria}
          className="grid grid-cols-2 gap-x-6 gap-y-7 text-xs sm:grid-cols-4"
        >
          {columns.map((column) => (
            <div key={column.title}>
              <p className="mb-2 font-medium text-ink-100">{column.title}</p>
              <ul className="space-y-1.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-ink-400 transition-colors hover:text-ink-100"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-ink-800 pt-4 text-xs text-ink-400">
          <span className="flex items-center gap-2.5">
            <span className="text-[13px]">
              <Logo />
            </span>
            <span>
              © {new Date().getFullYear()} Resourcepool. {f.rights}
            </span>
          </span>
          <span>{fmt(f.version, { version: pkg.version })}</span>
        </div>
      </div>
    </footer>
  );
}

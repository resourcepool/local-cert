'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/client';

export function NavLinks({ items }: { items: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav aria-label={t.shell.nav.aria} className="flex flex-wrap gap-0.5 text-[13px]">
      {items.map((item) => {
        // "/admin" is the overview: it only matches exactly, or it would light
        // up for every page under it.
        const active =
          item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-2.5 py-1.5 transition-colors ${
              active
                ? 'bg-ink-800 font-medium text-ink-100'
                : 'text-ink-400 hover:bg-ink-800/60 hover:text-ink-100'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

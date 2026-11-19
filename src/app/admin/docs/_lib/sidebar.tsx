'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/client';
import { SECTIONS, hrefOf } from './nav';

export function DocsSidebar() {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav aria-label={t.docs.sidebarAria} className="space-y-5 text-xs">
      {SECTIONS.map((section) => (
        <div key={section.id}>
          <p className="mb-1.5 text-[11px] font-semibold text-ink-400">
            {t.docsNav.sections[section.id]}
          </p>
          <ul className="space-y-0.5">
            {section.slugs.map((slug) => {
              const href = hrefOf(slug);
              const active = pathname === href;
              return (
                <li key={slug}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`block border-l py-1 pl-2.5 transition-colors ${
                      active
                        ? 'border-accent text-accent'
                        : 'border-ink-700 text-ink-300 hover:border-ink-400 hover:text-ink-100'
                    }`}
                  >
                    {t.docsNav.entries[slug].title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

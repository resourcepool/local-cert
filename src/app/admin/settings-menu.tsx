'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { LanguageSelect } from '@/components/language-select';

const GROUPS = [
  {
    title: 'configuration',
    items: [
      { href: '/admin/providers', label: 'providers', hint: 'providersHint' },
      { href: '/admin/keys', label: 'keys', hint: 'keysHint' },
    ],
  },
  {
    title: 'reference',
    items: [
      { href: '/admin/api', label: 'api', hint: 'apiHint' },
      { href: '/admin/docs', label: 'docs', hint: 'docsHint' },
    ],
  },
] as const;

/**
 * Everything that is set up once and then left alone lives here, so the main
 * navigation keeps to what is looked at every day.
 */
export function SettingsMenu({ user }: { user: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT().shell.settings;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // A destination was picked.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const inside = GROUPS.some((g) => g.items.some((i) => pathname.startsWith(i.href)));

  async function signOut() {
    await fetch('/api/admin/session', { method: 'DELETE' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
          open || inside
            ? 'border-ink-600 bg-ink-800 text-ink-100'
            : 'border-ink-700 text-ink-300 hover:border-ink-600 hover:text-ink-100'
        }`}
      >
        <svg
          viewBox="0 0 16 16"
          width="13"
          height="13"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        >
          <path d="M2 4.5h7M12.5 4.5H14M2 11.5h1.5M7 11.5h7" />
          <circle cx="10.75" cy="4.5" r="1.75" />
          <circle cx="5.25" cy="11.5" r="1.75" />
        </svg>
        {t.label}
        <svg viewBox="0 0 10 6" width="8" height="5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m1 1 4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t.label}
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-ink-700 bg-ink-900 p-1.5 shadow-xl shadow-black/30"
        >
          {GROUPS.map((group) => (
            <div key={group.title} className="mb-1 border-b border-ink-800 pb-1">
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-ink-400">{t[group.title]}</p>
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-md px-2.5 py-1.5 transition-colors ${
                      active ? 'bg-ink-800' : 'hover:bg-ink-800/60'
                    }`}
                  >
                    <span className={`block text-[13px] ${active ? 'font-medium text-ink-100' : 'text-ink-100'}`}>
                      {t[item.label]}
                    </span>
                    <span className="block text-[11px] text-ink-400">{t[item.hint]}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          <label className="mb-1 flex items-center justify-between gap-3 border-b border-ink-800 px-2.5 pb-2 pt-1 text-[13px] text-ink-100">
            {t.language}
            <LanguageSelect />
          </label>
          <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
            <span className="min-w-0 truncate text-[11px] text-ink-400" title={user}>
              {user}
            </span>
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="shrink-0 rounded-md px-1.5 py-1 text-xs text-ink-300 transition-colors hover:text-danger"
            >
              {t.signOut}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

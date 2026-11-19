'use client';

import { useEffect, useState } from 'react';
import { fmt } from '@/lib/i18n/format';
import { useT } from '@/lib/i18n/client';

type Choice = 'auto' | 'light' | 'dark';

/** Same key and resolution as the boot script in app/layout.tsx. */
const KEY = 'lc-theme';
const ORDER: Choice[] = ['auto', 'light', 'dark'];

function apply(choice: Choice) {
  const dark =
    choice === 'dark' ||
    (choice === 'auto' && !window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function ThemeToggle() {
  const t = useT().shell.theme;
  // null until mounted: the stored choice is unknown on the server.
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {}
    setChoice(stored === 'light' || stored === 'dark' ? stored : 'auto');
  }, []);

  // While on "auto", follow the system when it changes.
  useEffect(() => {
    if (choice !== 'auto') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => apply('auto');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [choice]);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(choice ?? 'auto') + 1) % ORDER.length];
    setChoice(next);
    try {
      if (next === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {}
    apply(next);
  }

  const current = choice ?? 'auto';
  return (
    <button
      type="button"
      onClick={cycle}
      title={t.title}
      aria-label={fmt(t.aria, { current: t[current] })}
      className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
    >
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        {current === 'dark' ? (
          <path d="M13 9.6A5.6 5.6 0 0 1 6.4 3 5.6 5.6 0 1 0 13 9.6Z" strokeLinejoin="round" />
        ) : current === 'light' ? (
          <>
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
          </>
        ) : (
          <>
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 2.5v11a5.5 5.5 0 0 0 0-11Z" fill="currentColor" stroke="none" />
          </>
        )}
      </svg>
      <span suppressHydrationWarning>{t[current]}</span>
    </button>
  );
}

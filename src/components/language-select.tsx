'use client';

import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES } from '@/lib/i18n/config';
import { useLocale, useT } from '@/lib/i18n/client';

/**
 * Stores the choice in a cookie the server reads on the next render; nothing
 * else changes, so the page stays where it is.
 */
export function LanguageSelect({ className = '' }: { className?: string }) {
  const router = useRouter();
  const locale = useLocale();
  const label = useT().shell.settings.language;
  return (
    <select
      aria-label={label}
      value={locale}
      onChange={(e) => {
        document.cookie = `${LOCALE_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
      className={`rounded-md border border-ink-700 bg-ink-950 px-1.5 py-1 text-xs text-ink-100 focus:border-accent focus:outline-none ${className}`}
    >
      {LOCALES.map((code) => (
        <option key={code} value={code} lang={code}>
          {LOCALE_NAMES[code]}
        </option>
      ))}
    </select>
  );
}

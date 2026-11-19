'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from './config';
import type { Messages } from './messages';

const I18nContext = createContext<{ locale: Locale; messages: Messages } | null>(null);

/**
 * Mounted once in the root layout with the messages of the visitor's language,
 * so client components never ship the other five.
 */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  return <I18nContext.Provider value={{ locale, messages }}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useT() needs <I18nProvider> above it');
  return value;
}

/** The translated messages: `const t = useT(); t.common.cancel`. */
export const useT = (): Messages => useI18n().messages;

/** The current language, for `toLocaleString(locale)` and the like. */
export const useLocale = (): Locale => useContext(I18nContext)?.locale ?? DEFAULT_LOCALE;

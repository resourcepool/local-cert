import 'server-only';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, isLocale, matchLocale, type Locale } from './config';
import { MESSAGES, type Messages } from './messages';

/** The visitor's language: their explicit choice, else what the browser asks for. */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return matchLocale((await headers()).get('accept-language'));
}

export async function getMessages(): Promise<Messages> {
  return MESSAGES[await getLocale()];
}

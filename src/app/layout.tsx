import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n/client';
import { getLocale } from '@/lib/i18n/server';
import { MESSAGES } from '@/lib/i18n/messages';

export const metadata: Metadata = {
  title: { default: 'local-cert', template: '%s · local-cert' },
  description: "Let's Encrypt certificates for LAN hosts, via Route53 DNS-01",
};

/**
 * Resolves the theme before first paint, so a light-theme visitor never sees a
 * dark flash. Same storage key and rule as components/theme-toggle.tsx.
 */
const THEME_BOOT = `(function(){try{var c=localStorage.getItem('lc-theme');var d=c==='dark'||(c!=='light'&&!matchMedia('(prefers-color-scheme: light)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    // data-theme is written by the boot script, hence the hydration opt-out.
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-screen">
        <I18nProvider locale={locale} messages={MESSAGES[locale]}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}

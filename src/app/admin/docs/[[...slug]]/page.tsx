import type { ComponentType } from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { SLUGS, hrefOf, type DocSlug } from '../_lib/nav';
import type { DocCtx } from '../_lib/prose';
import { getLocale, getMessages } from '@/lib/i18n/server';
import type { Locale } from '@/lib/i18n/config';
import { PAGES as en } from '../_content/en';
import { PAGES as fr } from '../_content/fr';
import { PAGES as es } from '../_content/es';
import { PAGES as it } from '../_content/it';
import { PAGES as pt } from '../_content/pt';
import { PAGES as de } from '../_content/de';

export const dynamic = 'force-dynamic';

/** Each language carries its own copy of the guides: prose translates badly key by key. */
const CONTENT: Record<Locale, Record<DocSlug, ComponentType<{ ctx: DocCtx }>>> = {
  en,
  fr,
  es,
  it,
  pt,
  de,
};

/**
 * The origin clients must use — the same resolution as the ACME endpoints, so
 * a command copied from a guide carries the URL the server will accept.
 */
async function publicOrigin(): Promise<string> {
  const fixed = process.env.PUBLIC_URL?.trim();
  if (fixed) return fixed.replace(/\/+$/, '');
  const h = await headers();
  const first = (name: string) => h.get(name)?.split(',')[0].trim() || null;
  const host = first('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = first('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const slug = ((await params).slug ?? []).join('/');
  if (!(SLUGS as string[]).includes(slug)) notFound();
  const [locale, t] = await Promise.all([getLocale(), getMessages()]);
  const Body = CONTENT[locale][slug as DocSlug];

  const origin = await publicOrigin();
  const ctx: DocCtx = { origin, directory: `${origin}/acme/directory` };

  const index = SLUGS.indexOf(slug as DocSlug);
  const prev = index > 0 ? SLUGS[index - 1] : null;
  const next = index < SLUGS.length - 1 ? SLUGS[index + 1] : null;
  const titleOf = (s: DocSlug) => t.docsNav.entries[s].title;

  return (
    <>
      <article className="doc">
        <Body ctx={ctx} />
      </article>
      <nav
        aria-label={t.docs.neighboursAria}
        className="mt-10 flex max-w-[78ch] justify-between gap-4 border-t border-ink-700 pt-4 text-xs"
      >
        {prev ? (
          <Link href={hrefOf(prev)} className="text-ink-400 hover:text-ink-100">
            ← {titleOf(prev)}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={hrefOf(next)} className="text-right text-ink-400 hover:text-ink-100">
            {titleOf(next)} →
          </Link>
        )}
      </nav>
    </>
  );
}

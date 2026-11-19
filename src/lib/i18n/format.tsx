import { Fragment, type ReactNode } from 'react';

/** Fills `{name}` placeholders: fmt('Remove {name}', { name: 'x' }). */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/** Chooses between a singular and a plural message, then fills `{count}`. */
export function plural(count: number, one: string, other: string): string {
  return fmt(count === 1 ? one : other, { count });
}

type Part = ReactNode | ((chunk: string) => ReactNode);

/**
 * Like fmt, for sentences that carry markup. `{name}` takes a node, and
 * `<name>text</name>` hands the translated text to a function:
 *
 *   rich('Read the <a>guide</a> for {zone}', {
 *     a: (c) => <Link href="/admin/docs">{c}</Link>,
 *     zone: <code>example.com</code>,
 *   })
 *
 * A `{name}` inside a tag is filled when its value is text.
 * Translators can then reorder the sentence freely.
 */
export function rich(template: string, parts: Record<string, Part> = {}): ReactNode {
  const out: ReactNode[] = [];
  // Text values are also filled inside a tag: '<b>{name}</b>' is the common case.
  const fill = (chunk: string) =>
    chunk.replace(/\{(\w+)\}/g, (whole, key: string) => {
      const value = parts[key];
      return typeof value === 'string' || typeof value === 'number' ? String(value) : whole;
    });
  const re = /<(\w+)>(.*?)<\/\1>|\{(\w+)\}/gs;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    if (m.index > last) out.push(template.slice(last, m.index));
    const key = m[1] ?? m[3];
    const part = parts[key];
    if (m[1] !== undefined) {
      out.push(typeof part === 'function' ? part(fill(m[2])) : fill(m[2]));
    } else {
      out.push(part === undefined ? m[0] : typeof part === 'function' ? part('') : part);
    }
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push(template.slice(last));
  return out.map((node, i) => <Fragment key={i}>{node}</Fragment>);
}

import type { ReactNode } from 'react';
import { getMessages } from '@/lib/i18n/server';

/** What every guide needs to print commands that work as pasted. */
export interface DocCtx {
  /** public origin of this instance, e.g. https://certs.example.com */
  origin: string;
  /** the ACME directory URL clients are configured with */
  directory: string;
}

const CALLOUT = {
  note: 'border-info/40 bg-info/10',
  warn: 'border-warn/40 bg-warn/10',
  ok: 'border-accent/40 bg-accent/10',
} as const;

export function Callout({
  kind = 'note',
  title,
  children,
}: {
  kind?: keyof typeof CALLOUT;
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className={`rounded border px-3 py-2.5 text-[12.5px] leading-relaxed ${CALLOUT[kind]}`}>
      {title && <p className="mb-1 font-semibold text-ink-100">{title}</p>}
      <div className="text-ink-100/90">{children}</div>
    </aside>
  );
}

/** Placeholders used across the guides; kept identical so they are recognisable. */
export const EX = {
  host: 'nas.home.example.com',
  kid: 'eab_XXXXXXXXXXXXXXXX',
  hmac: 'CLE_HMAC',
  email: 'ops@example.com',
} as const;

/** The three values a client needs, as the console shows them. */
export async function EabValues({ ctx }: { ctx: DocCtx }) {
  const t = (await getMessages()).docs.eab;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t.value}</th>
            <th>{t.where}</th>
            <th>{t.inGuide}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{t.directory}</td>
            <td>{t.directoryWhere}</td>
            <td>
              <code>{ctx.directory}</code>
            </td>
          </tr>
          <tr>
            <td>{t.kid}</td>
            <td>{t.kidWhere}</td>
            <td>
              <code>{EX.kid}</code>
            </td>
          </tr>
          <tr>
            <td>{t.hmac}</td>
            <td>{t.hmacWhere}</td>
            <td>
              <code>{EX.hmac}</code>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

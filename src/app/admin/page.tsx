import Link from 'next/link';
import { db } from '@/lib/db';
import { Panel, StatusBadge, Table } from '@/components/ui';
import { accountStatus } from '@/lib/acme/client';
import { getMessages } from '@/lib/i18n/server';
import { fmt, rich } from '@/lib/i18n/format';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const t = (await getMessages()).overview;
  const [certs, domains, keys, audit] = await Promise.all([
    db().selectFrom('certificates').selectAll().orderBy('updated_at', 'desc').limit(200).execute(),
    db().selectFrom('domains').selectAll().execute(),
    db().selectFrom('api_keys').selectAll().where('revoked_at', 'is', null).execute(),
    db().selectFrom('audit_log').selectAll().orderBy('at', 'desc').limit(12).execute(),
  ]);

  let acme: Awaited<ReturnType<typeof accountStatus>> | { error: string };
  try {
    acme = await accountStatus();
  } catch (err) {
    acme = { error: (err as Error).message };
  }

  const issued = certs.filter((c) => c.status === 'issued');
  const failing = certs.filter((c) => c.status === 'failed');
  const inflight = certs.filter((c) =>
    ['pending', 'dns_propagating', 'validating'].includes(c.status),
  );
  const expiringSoon = issued.filter(
    (c) => c.not_after && new Date(c.not_after).getTime() - Date.now() < 30 * 86_400_000,
  );

  const stats = [
    { label: t.stats.active, value: issued.length, tone: 'text-accent' },
    { label: t.stats.inflight, value: inflight.length, tone: 'text-info' },
    { label: t.stats.expiring, value: expiringSoon.length, tone: expiringSoon.length ? 'text-warn' : 'text-ink-300' },
    { label: t.stats.failed, value: failing.length, tone: failing.length ? 'text-danger' : 'text-ink-300' },
    { label: t.stats.domains, value: domains.length, tone: 'text-ink-100' },
    { label: t.stats.keys, value: keys.length, tone: 'text-ink-100' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded border border-ink-700 bg-ink-900/70 px-3 py-3">
            <div className={`text-2xl tabular-nums ${s.tone}`}>{s.value}</div>
            <div className="mt-1 text-[11px] text-ink-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title={t.latest.title}
          className="lg:col-span-2"
          action={
            <Link href="/admin/certificates" className="text-[11px] text-ink-400 hover:text-accent">
              {t.latest.viewAll}
            </Link>
          }
        >
          {certs.length === 0 ? (
            <Empty>
              {rich(t.latest.empty, { code: <code>POST /api/v1/certificates</code> })}
            </Empty>
          ) : (
            <Table head={[t.latest.head.domains, t.latest.head.status, t.latest.head.expires, t.latest.head.updated]}>
              {certs.slice(0, 8).map((c) => {
                const names: string[] = JSON.parse(c.domains);
                const days = c.not_after
                  ? Math.floor((new Date(c.not_after).getTime() - Date.now()) / 86_400_000)
                  : null;
                return (
                  <tr key={c.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-2 py-2 text-ink-100">{names.join(', ')}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-2 py-2 tabular-nums text-ink-300">
                      {days === null ? '—' : fmt(t.latest.daysShort, { count: days })}
                    </td>
                    <td className="px-2 py-2 text-ink-400">{c.updated_at.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>

        <Panel title={t.acme.title}>
          {'error' in acme ? (
            <p className="text-xs text-danger">{acme.error}</p>
          ) : (
            <dl className="space-y-2 text-xs">
              <Row k={t.acme.environment} v={acme.environment} />
              <Row k={t.acme.contact} v={acme.contact} />
              <Row k={t.acme.directory} v={acme.directory_url} mono />
              <Row k={t.acme.account} v={acme.account_url ?? t.acme.notCreated} mono />
            </dl>
          )}
          {acme && 'environment' in acme && acme.environment === 'staging' && (
            <p className="mt-3 rounded border border-warn/40 bg-warn/10 px-2 py-1.5 text-[11px] text-warn">
              {rich(t.acme.stagingWarning, { code: <code>ACME_ENV=production</code> })}
            </p>
          )}
        </Panel>
      </div>

      <Panel title={t.audit.title}>
        {audit.length === 0 ? (
          <Empty>{t.audit.empty}</Empty>
        ) : (
          <Table head={[t.audit.head.when, t.audit.head.action, t.audit.head.target, t.audit.head.ip]}>
            {audit.map((a) => (
              <tr key={a.id} className="border-b border-ink-800 last:border-0">
                <td className="px-2 py-1.5 text-ink-400">{a.at.slice(0, 19).replace('T', ' ')}</td>
                <td className="px-2 py-1.5 text-ink-100">{a.action}</td>
                <td className="px-2 py-1.5 text-ink-300">{a.target ?? '—'}</td>
                <td className="px-2 py-1.5 text-ink-400">{a.ip ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-ink-400">{k}</dt>
      <dd className={`min-w-0 break-all ${mono ? 'text-ink-300' : 'text-ink-100'}`}>{v}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-xs text-ink-400">{children}</p>;
}

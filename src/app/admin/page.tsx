import Link from 'next/link';
import { db } from '@/lib/db';
import { Panel, StatusBadge, Table } from '@/components/ui';
import { accountStatus } from '@/lib/acme/client';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
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
    { label: 'Certificats actifs', value: issued.length, tone: 'text-accent' },
    { label: 'En cours', value: inflight.length, tone: 'text-info' },
    { label: 'Expirent < 30j', value: expiringSoon.length, tone: expiringSoon.length ? 'text-warn' : 'text-ink-300' },
    { label: 'En échec', value: failing.length, tone: failing.length ? 'text-danger' : 'text-ink-300' },
    { label: 'Domaines gérés', value: domains.length, tone: 'text-ink-100' },
    { label: 'Clés actives', value: keys.length, tone: 'text-ink-100' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded border border-ink-700 bg-ink-900/70 px-3 py-3">
            <div className={`text-2xl tabular-nums ${s.tone}`}>{s.value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Derniers certificats"
          className="lg:col-span-2"
          action={
            <Link href="/admin/certificates" className="text-[11px] text-ink-400 hover:text-accent">
              tout voir →
            </Link>
          }
        >
          {certs.length === 0 ? (
            <Empty>
              Aucun certificat. Déclarez d&apos;abord un domaine, puis appelez{' '}
              <code>POST /api/v1/certificates</code>.
            </Empty>
          ) : (
            <Table head={['Domaines', 'Statut', 'Expire', 'Maj']}>
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
                      {days === null ? '—' : `${days} j`}
                    </td>
                    <td className="px-2 py-2 text-ink-400">{c.updated_at.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>

        <Panel title="Compte ACME">
          {'error' in acme ? (
            <p className="text-xs text-danger">{acme.error}</p>
          ) : (
            <dl className="space-y-2 text-xs">
              <Row k="Environnement" v={acme.environment} />
              <Row k="Contact" v={acme.contact} />
              <Row k="Directory" v={acme.directory_url} mono />
              <Row k="Compte" v={acme.account_url ?? 'non créé'} mono />
            </dl>
          )}
          {acme && 'environment' in acme && acme.environment === 'staging' && (
            <p className="mt-3 rounded border border-warn/40 bg-warn/10 px-2 py-1.5 text-[11px] text-warn">
              Environnement staging : les certificats émis ne sont pas reconnus par les navigateurs.
              Passez <code>ACME_ENV=production</code> une fois le flux validé.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Journal d’audit">
        {audit.length === 0 ? (
          <Empty>Rien pour l&apos;instant.</Empty>
        ) : (
          <Table head={['Quand', 'Action', 'Cible', 'IP']}>
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

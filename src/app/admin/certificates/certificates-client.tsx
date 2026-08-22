'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, ErrorNote, Field, Input, Panel, Select, StatusBadge, api } from '@/components/ui';

type Cert = {
  id: string;
  status: string;
  domains: string[];
  managed_domain: string;
  key_type: string;
  serial: string | null;
  issuer: string | null;
  not_after: string | null;
  days_remaining: number | null;
  auto_renew: boolean;
  last_error: string | null;
  created_at: string;
};

type DomainRef = { id: string; name: string; default_ttl: number };

export function CertificatesClient({
  certificates,
  domains,
}: {
  certificates: Cert[];
  domains: DomainRef[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [form, setForm] = useState({
    host: '',
    domain: domains[0]?.name ?? '',
    wildcard: false,
    key_type: 'ec-256',
    target_ip: '',
    create_record: true,
    auto_renew: true,
  });

  const fqdn = form.wildcard
    ? `*.${form.domain}`
    : form.host
      ? `${form.host}.${form.domain}`
      : form.domain;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body: Record<string, unknown> = {
        domains: [fqdn],
        key_type: form.key_type,
        auto_renew: form.auto_renew,
      };
      if (form.create_record && form.target_ip && !form.wildcard) {
        body.dns = { create_record: true, target_ip: form.target_ip, ttl: 60 };
      }
      const cert = await api<Cert>('/api/v1/certificates', {
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      setForm({ ...form, host: '', target_ip: '' });
      setOpenLog(cert.id);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function act(id: string, path: string, method: string) {
    setError(null);
    setWarnings([]);
    try {
      const res = await api<{ warnings?: string[] }>(`/api/v1/certificates/${id}${path}`, {
        method,
      });
      setWarnings(res.warnings ?? []);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <ErrorNote>{error}</ErrorNote>
      {warnings.map((w) => (
        <p
          key={w}
          className="rounded border border-warn/40 bg-warn/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-warn"
        >
          {w}
        </p>
      ))}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Panel title={`Certificats (${certificates.length})`}>
          {certificates.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-400">
              Aucun certificat émis. Utilisez le formulaire à droite ou{' '}
              <code>POST /api/v1/certificates</code>.
            </p>
          ) : (
            <div className="space-y-2">
              {certificates.map((c) => (
                <div key={c.id} className="rounded border border-ink-700 bg-ink-900/60">
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <StatusBadge status={c.status} />
                    <span className="text-ink-100">{c.domains.join(', ')}</span>
                    <span className="text-[11px] text-ink-600">{c.key_type}</span>
                    {c.days_remaining !== null && (
                      <span
                        className={`text-[11px] tabular-nums ${
                          c.days_remaining < 15
                            ? 'text-danger'
                            : c.days_remaining < 30
                              ? 'text-warn'
                              : 'text-ink-400'
                        }`}
                      >
                        {c.days_remaining} j restants
                      </span>
                    )}
                    {c.auto_renew && <span className="text-[11px] text-ink-600">auto-renew</span>}

                    <div className="ml-auto flex flex-wrap gap-1.5">
                      <Button variant="ghost" onClick={() => setOpenLog(openLog === c.id ? null : c.id)}>
                        {openLog === c.id ? 'fermer' : 'logs'}
                      </Button>
                      {c.status === 'issued' && (
                        <a
                          href={`/api/v1/certificates/${c.id}/bundle?format=pem&include=fullchain,key`}
                          className="rounded border border-ink-600 bg-ink-800 px-2.5 py-1 text-xs text-ink-100 hover:border-ink-400"
                        >
                          .pem
                        </a>
                      )}
                      <Button onClick={() => act(c.id, '/renew', 'POST')}>renouveler</Button>
                      <Button variant="danger" onClick={() => act(c.id, '?purge=true', 'DELETE')}>
                        supprimer
                      </Button>
                    </div>
                  </div>

                  {c.last_error && (
                    <p className="border-t border-ink-800 px-3 py-1.5 text-[11px] text-danger">
                      {c.last_error}
                    </p>
                  )}

                  {openLog === c.id && <EventLog certId={c.id} status={c.status} />}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Émettre un certificat">
          {domains.length === 0 ? (
            <p className="text-xs text-ink-400">Déclarez d&apos;abord un domaine.</p>
          ) : (
            <form onSubmit={create} className="space-y-3">
              <Field label="Domaine géré">
                <Select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
                  {domains.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <label className="flex items-center gap-2 text-xs text-ink-300">
                <input
                  type="checkbox"
                  checked={form.wildcard}
                  onChange={(e) => setForm({ ...form, wildcard: e.target.checked })}
                  className="accent-[var(--color-accent)]"
                />
                Wildcard <code className="text-ink-600">*.{form.domain}</code>
              </label>

              {!form.wildcard && (
                <Field label="Hôte" hint="partie gauche du sous-domaine">
                  <Input
                    placeholder="nas"
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                  />
                </Field>
              )}

              <div className="rounded border border-ink-800 bg-ink-950 px-2.5 py-1.5 text-xs">
                <span className="text-ink-600">sujet : </span>
                <span className="text-accent">{fqdn}</span>
              </div>

              <Field label="Type de clé">
                <Select
                  value={form.key_type}
                  onChange={(e) => setForm({ ...form, key_type: e.target.value })}
                >
                  <option value="ec-256">ECDSA P-256 (recommandé)</option>
                  <option value="ec-384">ECDSA P-384</option>
                  <option value="rsa-2048">RSA 2048</option>
                  <option value="rsa-4096">RSA 4096</option>
                </Select>
              </Field>

              {!form.wildcard && (
                <>
                  <label className="flex items-center gap-2 text-xs text-ink-300">
                    <input
                      type="checkbox"
                      checked={form.create_record}
                      onChange={(e) => setForm({ ...form, create_record: e.target.checked })}
                      className="accent-[var(--color-accent)]"
                    />
                    Publier aussi l&apos;enregistrement A
                  </label>
                  {form.create_record && (
                    <Field label="IP locale" hint="publiée dans la zone publique Route53">
                      <Input
                        placeholder="192.168.1.50"
                        value={form.target_ip}
                        onChange={(e) => setForm({ ...form, target_ip: e.target.value })}
                      />
                    </Field>
                  )}
                </>
              )}

              <label className="flex items-center gap-2 text-xs text-ink-300">
                <input
                  type="checkbox"
                  checked={form.auto_renew}
                  onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })}
                  className="accent-[var(--color-accent)]"
                />
                Renouvellement automatique (J-30)
              </label>

              <Button type="submit" variant="primary" className="w-full">
                Émettre
              </Button>
              <p className="text-[11px] leading-relaxed text-ink-600">
                L&apos;émission est asynchrone : DNS-01 prend 1 à 3 minutes le temps que le TXT se
                propage sur tous les NS autoritatifs.
              </p>
            </form>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Live tail of the order via SSE; falls back to the static history once terminal. */
function EventLog({ certId, status }: { certId: string; status: string }) {
  const [lines, setLines] = useState<Array<{ at: string; step: string; message: string; level: string }>>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const terminal = ['issued', 'failed', 'revoked', 'expired'].includes(status);

    if (terminal) {
      void fetch(`/api/v1/certificates/${certId}/events`)
        .then((r) => r.json())
        .then((d) => !cancelled && setLines(d.events ?? []));
      return () => {
        cancelled = true;
      };
    }

    const es = new EventSource(`/api/v1/certificates/${certId}/events?stream=1`);
    es.addEventListener('event', (e) => {
      setLines((prev) => [...prev, JSON.parse((e as MessageEvent).data)]);
    });
    es.addEventListener('done', () => {
      es.close();
      router.refresh();
    });
    es.onerror = () => es.close();
    return () => {
      cancelled = true;
      es.close();
    };
  }, [certId, status, router]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [lines]);

  return (
    <div
      ref={boxRef}
      className="max-h-56 overflow-y-auto border-t border-ink-800 bg-ink-950 px-3 py-2 text-[11px] leading-relaxed"
    >
      {lines.length === 0 ? (
        <p className="text-ink-600">en attente d&apos;événements…</p>
      ) : (
        lines.map((l, i) => (
          <div key={i} className="flex gap-2">
            <span className="shrink-0 text-ink-600">{l.at.slice(11, 19)}</span>
            <span className="w-36 shrink-0 text-ink-400">{l.step}</span>
            <span
              className={
                l.level === 'error' ? 'text-danger' : l.level === 'warn' ? 'text-warn' : 'text-ink-300'
              }
            >
              {l.message}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

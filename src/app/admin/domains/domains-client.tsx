'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ApiClientError,
  Button,
  Copyable,
  ErrorNote,
  Field,
  Input,
  Panel,
  PreflightTable,
  Table,
  api,
  type PreflightCheckView,
} from '@/components/ui';

export interface DomainView {
  id: string;
  name: string;
  route53_zone_id: string;
  aws_region: string;
  aws_role_arn: string | null;
  default_ttl: number;
  created_at: string;
  certificate_count: number;
}

export function DomainsClient({ initial }: { initial: DomainView[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    route53_zone_id: '',
    aws_region: 'us-east-1',
    aws_role_arn: '',
    default_ttl: 60,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preflight, setPreflight] = useState<PreflightCheckView[] | null>(null);
  /** set once a preflight has failed, so the operator can register anyway */
  const [canForceCreate, setCanForceCreate] = useState(false);
  /** domain id -> how many certificates are blocking its deletion */
  const [blocked, setBlocked] = useState<Record<string, number>>({});

  async function create(e: React.FormEvent, force = false) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setWarnings([]);
    try {
      const res = await api<{ preflight?: PreflightCheckView[]; warnings?: string[] }>(
        `/api/admin/domains${force ? '?force=true' : ''}`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            aws_role_arn: form.aws_role_arn.trim() || null,
            default_ttl: Number(form.default_ttl),
          }),
        },
      );
      setPreflight(res.preflight ?? null);
      setWarnings(res.warnings ?? []);
      setCanForceCreate(false);
      setForm({ name: '', route53_zone_id: '', aws_region: 'us-east-1', aws_role_arn: '', default_ttl: 60 });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      const detail =
        err instanceof ApiClientError
          ? (err.body?.detail as { checks?: PreflightCheckView[] } | undefined)
          : undefined;
      setPreflight(detail?.checks ?? null);
      setCanForceCreate(Boolean(detail?.checks));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string, force = false) {
    setError(null);
    setWarnings([]);
    try {
      const res = await api<{ warnings?: string[]; certificates_removed: number }>(
        `/api/admin/domains/${id}${force ? '?force=true' : ''}`,
        { method: 'DELETE' },
      );
      setWarnings(res.warnings ?? []);
      setBlocked((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      router.refresh();
    } catch (err) {
      const message = (err as Error).message;
      // The API reports how many certificates pin the domain; surface the
      // forced path inline rather than making the operator guess the flag.
      const count = /has (\d+) certificate/.exec(message);
      if (count) setBlocked((prev) => ({ ...prev, [id]: Number(count[1]) }));
      setError(`${name} : ${message}`);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Panel title="Domaines gérés">
        {initial.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-400">
            Aucun domaine. Ajoutez la zone Route53 qui héberge vos sous-domaines LAN.
          </p>
        ) : (
          <Table head={['Domaine', 'Zone Route53', 'Région', 'TTL', 'Certs', '']}>
            {initial.map((d) => (
              <tr key={d.id} className="border-b border-ink-800 last:border-0">
                <td className="px-2 py-2">
                  <div className="text-ink-100">{d.name}</div>
                  {d.aws_role_arn && (
                    <div className="text-[10px] text-ink-600">assume {d.aws_role_arn}</div>
                  )}
                </td>
                <td className="px-2 py-2">
                  <Copyable value={d.route53_zone_id} />
                </td>
                <td className="px-2 py-2 text-ink-300">{d.aws_region}</td>
                <td className="px-2 py-2 tabular-nums text-ink-300">{d.default_ttl}s</td>
                <td className="px-2 py-2 tabular-nums text-ink-300">{d.certificate_count}</td>
                <td className="px-2 py-2 text-right">
                  {blocked[d.id] ? (
                    <Button
                      variant="danger"
                      title={`Supprime aussi ${blocked[d.id]} certificat(s)`}
                      onClick={() => remove(d.id, d.name, true)}
                    >
                      forcer ({blocked[d.id]})
                    </Button>
                  ) : (
                    <Button variant="danger" onClick={() => remove(d.id, d.name)}>
                      retirer
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
        <div className="mt-3 space-y-2">
          <ErrorNote>{error}</ErrorNote>
          {Object.keys(blocked).length > 0 && (
            <p className="text-[11px] leading-relaxed text-ink-400">
              « forcer » révoque les certificats, tente de nettoyer la zone puis supprime tout de la
              base. Le nettoyage DNS est au mieux : si l&apos;accès Route53 est perdu, la suppression
              en base aboutit quand même et les enregistrements restants sont listés.
            </p>
          )}
          {warnings.map((w) => (
            <p
              key={w}
              className="rounded border border-warn/40 bg-warn/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-warn"
            >
              {w}
            </p>
          ))}
        </div>
      </Panel>

      <Panel title="Déclarer un domaine">
        <form onSubmit={create} className="space-y-3">
          <Field label="Nom de base" hint="ex. home.example.com — tous les SAN devront être dessous">
            <Input
              required
              placeholder="home.example.com"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Hosted zone id" hint="Z0123456ABCDEFGHIJK">
            <Input
              required
              placeholder="Z0123456ABCDEFGHIJK"
              value={form.route53_zone_id}
              onChange={(e) => setForm({ ...form, route53_zone_id: e.target.value })}
            />
          </Field>
          <Field label="Région AWS">
            <Input
              required
              value={form.aws_region}
              onChange={(e) => setForm({ ...form, aws_region: e.target.value })}
            />
          </Field>
          <Field label="Rôle à assumer" hint="optionnel — sinon la chaîne de credentials par défaut">
            <Input
              placeholder="arn:aws:iam::123456789012:role/local-cert-dns"
              value={form.aws_role_arn}
              onChange={(e) => setForm({ ...form, aws_role_arn: e.target.value })}
            />
          </Field>
          <Field label="TTL par défaut">
            <Input
              type="number"
              min={30}
              max={86400}
              value={form.default_ttl}
              onChange={(e) => setForm({ ...form, default_ttl: Number(e.target.value) })}
            />
          </Field>
          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {busy ? 'Vérification des permissions…' : 'Ajouter'}
          </Button>

          {preflight && (
            <div className="rounded border border-ink-800 bg-ink-950 p-2.5">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-400">
                Préflight Route53
              </p>
              <PreflightTable checks={preflight} />
            </div>
          )}

          {canForceCreate && (
            <Button
              type="button"
              variant="danger"
              className="w-full"
              disabled={busy}
              onClick={(e) => create(e as unknown as React.FormEvent, true)}
            >
              Enregistrer quand même
            </Button>
          )}

          <p className="text-[11px] leading-relaxed text-ink-600">
            Les cinq appels Route53 dont local-cert a besoin sont testés avant l&apos;enregistrement.
            L&apos;écriture est sondée par un <code>DELETE</code> d&apos;un enregistrement qui ne peut
            pas exister : la zone n&apos;est jamais modifiée. Une politique partielle — le classique
            étant <code>TXT</code> manquant, qui rend DNS-01 impossible — est ainsi détectée
            maintenant plutôt qu&apos;à la première émission.
          </p>
        </form>
      </Panel>
    </div>
  );
}

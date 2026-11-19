'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ApiClientError,
  Button,
  CodeBlock,
  ConfirmDialog,
  Copyable,
  ErrorNote,
  Field,
  Input,
  Modal,
  Panel,
  PreflightTable,
  Stepper,
  Table,
  api,
  type PreflightCheckView,
} from '@/components/ui';
import type { DomainPreflight, ProviderPolicy, ProviderZoneList } from '@/lib/api/schemas';
import { ProviderLogo } from '@/components/provider-logo';
import { useT } from '@/lib/i18n/client';
import { localizeProvider } from '@/lib/i18n/provider-text';
import { fmt, plural, rich } from '@/lib/i18n/format';
import { PROVIDER_INFO, type ProviderType } from '@/lib/dns/provider-types';

export interface DomainView {
  id: string;
  name: string;
  route53_zone_id: string;
  aws_region: string;
  aws_role_arn: string | null;
  default_ttl: number;
  created_at: string;
  provider_id: string | null;
  provider_name: string | null;
  provider_type?: ProviderType | null;
  certificate_count: number;
  status: 'active' | 'pending' | 'error';
  check_attempts: number;
  check_error: string | null;
}

/** mirrors DOMAIN_CHECK_MAX in lib/admin/domains.ts */
const CHECK_MAX = 5;

export interface ProviderOption {
  id: string;
  name: string;
  type: ProviderType;
  role_arn: string | null;
}

type Zone = ProviderZoneList['items'][number];

/** patient retest: 12 tries, 5 s apart = one minute */
const RETRIES = 12;
const RETRY_MS = 5000;

/**
 * Provider → zone → IAM policy → test → add.
 *
 * The policy step always shows the complete document for the provider (zones
 * already served + the new one) and tests it right away: when the rights are
 * already there the operator just confirms, otherwise they paste, retest, add.
 */
function AddDomainWizard({
  providers,
  onClose,
  onAdded,
}: {
  providers: ProviderOption[];
  onClose: () => void;
  onAdded: (warnings: string[]) => void;
}) {
  const t = useT();
  const w = t.domains.wizard;
  const bold = (c: string) => <b>{c}</b>;
  const [step, setStep] = useState(0);
  const [providerId, setProviderId] = useState(providers.length === 1 ? providers[0].id : '');
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [zone, setZone] = useState<Zone | null>(null);
  const [name, setName] = useState('');
  const [ttl, setTtl] = useState(60);
  const [policy, setPolicy] = useState<ProviderPolicy | null>(null);
  const [result, setResult] = useState<DomainPreflight | null>(null);
  const [busy, setBusy] = useState(false);
  /** > 0 while a patient retest is waiting for the rights to propagate */
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const provider = providers.find((p) => p.id === providerId) ?? null;
  // A zone the public DNS delegates elsewhere cannot validate anything.
  const usable = zones?.filter((z) => z.delegated !== false) ?? null;
  const elsewhere = zones?.filter((z) => z.delegated === false) ?? [];
  const host = localizeProvider(t, PROVIDER_INFO[provider?.type ?? 'aws']);
  const isAws = host.type === 'aws';
  const hostLabel = host.label;
  const hostDocs = host.docs;

  useEffect(() => {
    setZones(null);
    setZone(null);
    if (!providerId) return;
    let stale = false;
    setError(null);
    api<ProviderZoneList>(`/api/admin/providers/${providerId}/zones`)
      .then((res) => {
        if (!stale) setZones(res.items);
      })
      .catch((err) => {
        if (!stale) setError((err as Error).message);
      });
    return () => {
      stale = true;
    };
  }, [providerId]);

  const body = () => ({
    provider_id: providerId,
    route53_zone_id: zone?.id,
    name: name.trim().toLowerCase(),
    default_ttl: Number(ttl),
  });

  /**
   * `patient` is the retest after a paste: the provider applies a new policy
   * within seconds to a minute, during which a correct document still answers
   * "denied". Rather than making the operator click until it turns green, keep
   * asking for a while and say so.
   */
  async function test(patient = false) {
    setBusy(true);
    setError(null);
    setAttempt(0);
    try {
      const tries = patient ? RETRIES : 1;
      for (let i = 1; i <= tries; i++) {
        if (i > 1) {
          setAttempt(i);
          await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
        }
        const res = await api<DomainPreflight>('/api/admin/domains/preflight', {
          method: 'POST',
          body: JSON.stringify(body()),
        });
        setResult(res);
        if (res.ok || !res.covers) break;
      }
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    } finally {
      setAttempt(0);
      setBusy(false);
    }
  }

  async function toPolicy(e: React.FormEvent) {
    e.preventDefault();
    if (!zone) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setPolicy(
        await api<ProviderPolicy>(
          `/api/admin/providers/${providerId}/policy?zone_id=${encodeURIComponent(zone.id)}`,
        ),
      );
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      return;
    }
    await test();
  }

  /** `pending`: register now, let the worker re-test the rights for a few minutes */
  async function add(pending: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ warnings?: string[] }>(
        `/api/admin/domains${pending ? '?pending=true' : ''}`,
        { method: 'POST', body: JSON.stringify(body()) },
      );
      onAdded(res.warnings ?? []);
    } catch (err) {
      setError((err as Error).message);
      const detail =
        err instanceof ApiClientError
          ? (err.body?.detail as { checks?: PreflightCheckView[] } | undefined)
          : undefined;
      if (detail?.checks && result) setResult({ ...result, ok: false, checks: detail.checks });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={w.title}
      onClose={onClose}
      guard={step > 0 ? w.closeGuard : null}
      wide
    >
      <Stepper steps={[w.steps.provider, w.steps.zone, w.steps.rights]} current={step} />

      {step === 0 && (
        <div className="space-y-3">
          {providers.length === 0 ? (
            <p className="text-xs leading-relaxed text-ink-300">
              {rich(w.provider.none, {
                a: (c) => (
                  <Link href="/admin/providers" className="text-accent hover:underline">
                    {c}
                  </Link>
                ),
              })}
            </p>
          ) : (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-ink-300">
                {w.provider.legend}
              </legend>
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {providers.map((p) => {
                  const picked = p.id === providerId;
                  return (
                    <li key={p.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                          picked
                            ? 'border-accent bg-accent/10'
                            : 'border-ink-700 bg-ink-950 hover:border-ink-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="provider"
                          className="sr-only"
                          checked={picked}
                          onChange={() => setProviderId(p.id)}
                        />
                        <ProviderLogo type={p.type} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink-100">
                            {p.name}
                          </span>
                          <span className="block text-xs text-ink-400">
                            {PROVIDER_INFO[p.type].label} · {localizeProvider(t, PROVIDER_INFO[p.type]).product}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            picked ? 'border-accent' : 'border-ink-600'
                          }`}
                        >
                          {picked && <span className="h-2 w-2 rounded-full bg-accent" />}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}
          {providerId && !zones && !error && (
            <p className="text-xs text-ink-400">{w.provider.readingZones}</p>
          )}
          {zones && (
            <p className="text-xs text-ink-400">
              {plural((usable ?? zones).length, w.provider.usableOne, w.provider.usableOther)}
              {elsewhere.length > 0 &&
                `, ${plural(elsewhere.length, w.provider.hiddenOne, w.provider.hiddenOther)}`}
              .
            </p>
          )}
          <ErrorNote>{error}</ErrorNote>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="button" variant="primary" disabled={!zones} onClick={() => setStep(1)}>
              {t.common.next}
            </Button>
          </div>
        </div>
      )}

      {step === 1 && zones && (
        <form onSubmit={toPolicy} className="space-y-3">
          {zones.length === 0 ? (
            <p className="text-xs leading-relaxed text-ink-300">
              {fmt(w.zone.noZones, { host: hostLabel })}
            </p>
          ) : usable && usable.length === 0 ? (
            <p className="text-xs leading-relaxed text-ink-300">
              {fmt(w.zone.noUsable, { host: hostLabel })}
            </p>
          ) : (
            <ul className="max-h-64 divide-y divide-ink-800 overflow-y-auto rounded border border-ink-700">
              {(usable ?? zones).map((z) => (
                <li key={z.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-2.5 px-2.5 py-2 text-xs ${
                      z.private ? 'cursor-not-allowed opacity-50' : 'hover:bg-ink-800/60'
                    } ${zone?.id === z.id ? 'bg-ink-800' : ''}`}
                  >
                    <input
                      type="radio"
                      name="zone"
                      className="mt-0.5"
                      disabled={z.private}
                      checked={zone?.id === z.id}
                      onChange={() => {
                        setZone(z);
                        setName(z.name);
                      }}
                    />
                    <span className="min-w-0">
                      <span className="text-ink-100">{z.name}</span>{' '}
                      <span className="text-ink-400">{z.id}</span>
                      <span className="block text-[11px] text-ink-400">
                        {z.private
                          ? w.zone.private
                          : z.record_count === null
                            ? w.zone.public
                            : plural(z.record_count, w.zone.publicCountOne, w.zone.publicCountOther)}
                        {z.domains.length > 0 &&
                          ` · ${fmt(w.zone.alreadyManaged, { domains: z.domains.join(', ') })}`}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {elsewhere.length > 0 && (
            <details className="text-[11px] leading-relaxed text-ink-400">
              <summary className="cursor-pointer">
                {fmt(plural(elsewhere.length, w.zone.hiddenSummaryOne, w.zone.hiddenSummaryOther), {
                  host: hostLabel,
                })}
              </summary>
              <ul className="mt-1 space-y-0.5 pl-4">
                {elsewhere.map((z) => (
                  <li key={z.id}>
                    <span className="text-ink-300">{z.name}</span> —{' '}
                    {z.public_nameservers.length > 0
                      ? z.public_nameservers.join(', ')
                      : w.zone.noNameservers}
                  </li>
                ))}
              </ul>
              <p className="mt-1">
                {fmt(w.zone.hiddenExplain, { host: hostLabel })}
              </p>
            </details>
          )}

          {zone && (
            <>
              <Field
                label={w.zone.baseName}
                hint={fmt(w.zone.baseNameHint, { zone: zone.name })}
              >
                <Input required value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field
                label={w.zone.ttl}
                hint={
                  host.minTtl > 60
                    ? fmt(w.zone.ttlHint, { host: hostLabel, min: host.minTtl })
                    : undefined
                }
              >
                <Input
                  type="number"
                  min={30}
                  max={86400}
                  value={ttl}
                  onChange={(e) => setTtl(Number(e.target.value))}
                />
              </Field>
            </>
          )}

          <ErrorNote>{error}</ErrorNote>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep(0);
                setError(null);
              }}
            >
              {t.common.back}
            </Button>
            <Button type="submit" variant="primary" disabled={busy || !zone || !name.trim()}>
              {busy ? '…' : t.common.next}
            </Button>
          </div>
        </form>
      )}

      {step === 2 && policy && zone && (
        <div className="space-y-3">
          {result?.ok ? (
            <p className="rounded border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs text-accent">
              {fmt(w.rights.ok, { zone: zone.name })}
            </p>
          ) : policy.policy && policy.attach_to ? (
            <>
              <p className="text-xs leading-relaxed text-ink-300">
                {rich(w.rights.missing, {
                  b: bold,
                  provider: provider?.name ?? '',
                  zone: <b>{zone.name}</b>,
                })}
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-ink-300">
                <li>
                  {rich(w.rights.stepIam, {
                    b: bold,
                    kind: <b>{policy.attach_to.kind === 'role' ? w.rights.kindRole : w.rights.kindUser}</b>,
                    target: policy.attach_to.arn ? (
                      <code className="break-all text-ink-100">{policy.attach_to.arn}</code>
                    ) : (
                      w.rights.identityFallback
                    ),
                  })}
                  {policy.attach_to.arn && (
                    <>
                      {' '}
                      (
                      <a
                        className="text-accent hover:underline"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://console.aws.amazon.com/iam/home#/${
                          policy.attach_to.kind === 'role' ? 'roles' : 'users'
                        }/details/${encodeURIComponent(
                          policy.attach_to.arn.split('/').pop() ?? '',
                        )}?section=permissions`}
                      >
                        {w.rights.openConsole}
                      </a>
                      )
                    </>
                  )}
                  {policy.attach_to.kind === 'role' && (
                    <>
                      . {rich(w.rights.roleNote, { b: bold })}
                    </>
                  )}
                </li>
                <li>
                  {rich(w.rights.stepPermissions, {
                    b: bold,
                    policyName: <code className="text-ink-100">local-cert-route53</code>,
                  })}
                </li>
                <li>
                  {rich(w.rights.stepReplace, { b: bold })}
                </li>
                <li>{w.rights.stepRetest}</li>
              </ol>
            </>
          ) : (
            result && (
              <p className="text-xs leading-relaxed text-ink-300">
                {rich(w.rights.nonAws, {
                  b: bold,
                  provider: provider?.name ?? '',
                  zone: <b>{zone.name}</b>,
                  host: hostLabel,
                  a: (c) => (
                    <Link href={`/admin/docs/${hostDocs}`} className="text-accent hover:underline">
                      {fmt(c, { host: hostLabel })}
                    </Link>
                  ),
                })}
              </p>
            )
          )}

          {policy.policy && (
            <>
              <CodeBlock
                title={plural(policy.zone_ids.length, w.rights.policyTitleOne, w.rights.policyTitleOther)}
                code={JSON.stringify(policy.policy, null, 2)}
              />
              <p className="text-[11px] leading-relaxed text-ink-400">
                {rich(w.rights.policyNote, {
                  b: bold,
                  zone: zone.name,
                  policyName: <code>local-cert-route53</code>,
                })}
              </p>
            </>
          )}

          {result && (
            <div className="rounded border border-ink-800 bg-ink-950 p-2.5">
              <p className="mb-1.5 text-[11px] text-ink-400">
                {isAws ? w.rights.testAws : fmt(w.rights.testOther, { host: hostLabel })}{' '}
                {w.rights.testSlow}
              </p>
              <PreflightTable checks={result.checks} />
              {!result.covers && (
                <p className="mt-1.5 text-[11px] text-danger">
                  {fmt(w.rights.notCovered, { zoneName: result.zone_name ?? '', name: result.name })}
                </p>
              )}
            </div>
          )}
          {result && !result.ok && result.covers && (
            <p className="rounded border border-ink-700 bg-ink-950 px-2.5 py-2 text-[11px] leading-relaxed text-ink-300">
              <b className="text-ink-100">{w.rights.slowTitle}</b>{' '}
              {isAws ? w.rights.slowAws : fmt(w.rights.slowOther, { host: hostLabel })}{' '}
              {rich(w.rights.slowBody, { b: bold, max: CHECK_MAX })}
            </p>
          )}
          {busy && !result && <p className="text-xs text-ink-400">{w.rights.testing}</p>}
          <ErrorNote>{error}</ErrorNote>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep(1);
                setError(null);
              }}
            >
              {t.common.back}
            </Button>
            <Button type="button" disabled={busy} onClick={() => test(isAws)}>
              {busy
                ? attempt > 1
                  ? fmt(w.rights.testingAttempt, { attempt, max: RETRIES })
                  : w.rights.testingShort
                : w.rights.retest}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy || !result || !result.covers}
              onClick={() => add(!result?.ok)}
            >
              {result && !result.ok ? w.rights.addPending : w.rights.addDomain}
            </Button>
          </div>
          {attempt > 1 && (
            <p className="text-[11px] leading-relaxed text-warn">
              {fmt(w.rights.retrying, { attempt, max: RETRIES })}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function StatusBadge({ domain }: { domain: DomainView }) {
  const st = useT().domains.status;
  const look = {
    active: { text: st.active, cls: 'border-accent/40 bg-accent/10 text-accent' },
    pending: {
      text: fmt(st.pending, { attempt: Math.min(domain.check_attempts + 1, CHECK_MAX), max: CHECK_MAX }),
      cls: 'border-warn/40 bg-warn/10 text-warn',
    },
    error: { text: st.error, cls: 'border-danger/40 bg-danger/10 text-danger' },
  }[domain.status];
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] ${look.cls}`}>
      {look.text}
    </span>
  );
}

export function DomainsClient({
  initial,
  providers,
}: {
  initial: DomainView[];
  providers: ProviderOption[];
}) {
  const router = useRouter();
  const t = useT();
  const m = t.domains;
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [removing, setRemoving] = useState<DomainView | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  // Pending domains change state on their own, on the worker's clock.
  const waiting = initial.some((d) => d.status === 'pending');
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [waiting, router]);

  async function check(d: DomainView) {
    setError(null);
    setChecking(d.id);
    try {
      await api(`/api/admin/domains/${d.id}/check`, { method: 'POST' });
      router.refresh();
    } catch (err) {
      setError(fmt(m.checkFailed, { name: d.name, message: (err as Error).message }));
    } finally {
      setChecking(null);
    }
  }

  /** throws on failure: the confirmation dialog shows it and stays open */
  async function remove(d: DomainView) {
    const res = await api<{ warnings?: string[]; certificates_removed: number }>(
      `/api/admin/domains/${d.id}${d.certificate_count > 0 ? '?force=true' : ''}`,
      { method: 'DELETE' },
    );
    setError(null);
    setWarnings(res.warnings ?? []);
    setRemoving(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Panel
        title={m.panelTitle}
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            {m.addButton}
          </Button>
        }
      >
        {initial.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-400">
            {m.empty}
          </p>
        ) : (
          <Table head={[m.table.domain, m.table.state, m.table.provider, m.table.zone, m.table.ttl, m.table.certs, '']}>
            {initial.map((d) => (
              <tr key={d.id} className="border-b border-ink-800 align-top last:border-0">
                <td className="px-2 py-2 text-ink-100">{d.name}</td>
                <td className="max-w-64 px-2 py-2">
                  <StatusBadge domain={d} />
                  {d.status !== 'active' && d.check_error && (
                    <div
                      className="mt-1 line-clamp-3 break-words text-[11px] leading-snug text-ink-400"
                      title={d.check_error}
                    >
                      {d.check_error}
                    </div>
                  )}
                </td>
                <td className="px-2 py-2">
                  {d.provider_name ? (
                    <span className="inline-flex items-center gap-1.5 text-ink-300">
                      {d.provider_type && <ProviderLogo type={d.provider_type} size={18} />}
                      {d.provider_name}
                    </span>
                  ) : (
                    <span
                      className="text-ink-400"
                      title={m.envProviderTitle}
                    >
                      {m.envProvider}
                    </span>
                  )}
                  {d.aws_role_arn && (
                    <div className="break-all text-[11px] text-ink-600">{fmt(m.assume, { arn: d.aws_role_arn })}</div>
                  )}
                </td>
                <td className="px-2 py-2">
                  <Copyable value={d.route53_zone_id} />
                </td>
                <td className="px-2 py-2 tabular-nums text-ink-300">{d.default_ttl}s</td>
                <td className="px-2 py-2 tabular-nums text-ink-300">{d.certificate_count}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap justify-end gap-1.5">
                  {d.status !== 'active' && (
                    <Button
                      variant={d.status === 'error' ? 'primary' : undefined}
                      disabled={checking === d.id}
                      onClick={() => check(d)}
                    >
                      {checking === d.id
                        ? '…'
                        : d.status === 'error'
                          ? m.recheck
                          : m.checkNow}
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => setRemoving(d)}>
                    {t.common.remove}
                  </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
        <div className="mt-3 space-y-2">
          <ErrorNote>{error}</ErrorNote>
          {initial.some((d) => d.status !== 'active') && (
            <p className="text-[11px] leading-relaxed text-ink-400">
              {rich(m.pendingNote, { i: (c) => <i>{c}</i>, max: CHECK_MAX })}
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

      {removing && (
        <ConfirmDialog
          title={fmt(m.remove.title, { name: removing.name })}
          confirmLabel={
            removing.certificate_count > 0
              ? plural(
                  removing.certificate_count,
                  m.remove.confirmWithCertsOne,
                  m.remove.confirmWithCertsOther,
                )
              : m.remove.confirm
          }
          typed={removing.certificate_count > 0 ? removing.name : undefined}
          onClose={() => setRemoving(null)}
          onConfirm={() => remove(removing)}
        >
          {removing.certificate_count > 0 ? (
            <>
              <p>
                {rich(m.remove.withCerts, {
                  name: <b className="text-ink-100">{removing.name}</b>,
                  certs: (
                    <b className="text-ink-100">
                      {plural(removing.certificate_count, m.remove.certsOne, m.remove.certsOther)}
                    </b>
                  ),
                })}
              </p>
              <p className="text-ink-400">{m.remove.bestEffort}</p>
            </>
          ) : (
            <p>
              {rich(m.remove.plain, {
                name: <b className="text-ink-100">{removing.name}</b>,
              })}
            </p>
          )}
        </ConfirmDialog>
      )}

      {adding && (
        <AddDomainWizard
          providers={providers}
          onClose={() => setAdding(false)}
          onAdded={(w) => {
            setAdding(false);
            setWarnings(w);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

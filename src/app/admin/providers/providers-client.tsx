'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ApiClientError,
  Button,
  CodeBlock,
  Copyable,
  ErrorNote,
  Field,
  Input,
  Modal,
  Panel,
  Select,
  Stepper,
  Table,
  api,
} from '@/components/ui';
import type {
  ProviderDeleteResult,
  ProviderPolicy,
  ProviderProbe,
  ProviderResource,
} from '@/lib/api/schemas';
import { ProviderLogo } from '@/components/provider-logo';
import { fmt, plural, rich } from '@/lib/i18n/format';
import { localizeProvider } from '@/lib/i18n/provider-text';
import { useT } from '@/lib/i18n/client';
import {
  PROVIDER_INFO,
  PROVIDER_TYPES,
  type RemoteProviderType,
} from '@/lib/dns/provider-types';

type Dialog =
  | { kind: 'choose' }
  | { kind: 'create'; draft?: ProviderResource }
  | { kind: 'remote'; type: RemoteProviderType; provider?: ProviderResource }
  | { kind: 'edit'; provider: ProviderResource }
  | { kind: 'policy'; provider: ProviderResource }
  | { kind: 'remove'; provider: ProviderResource }
  | null;

const json = (doc: unknown) => JSON.stringify(doc, null, 2);

/** Inline markup shared by the translated sentences below. */
const tags = {
  b: (c: string) => <b>{c}</b>,
  i: (c: string) => <i>{c}</i>,
  code: (c: string) => <code>{c}</code>,
};

/** The three stages of a connection test, in the order they depend on each other. */
function ProbeReport({ probe }: { probe: ProviderProbe }) {
  const t = useT().providers;
  const rows: Array<{ label: string; ok: boolean; note: string }> = [
    {
      label: probe.policies ? t.probe.keyPair : t.probe.credentials,
      ...probe.identity,
    },
    ...(probe.role ? [{ label: t.probe.role, ...probe.role }] : []),
    { label: probe.policies ? t.probe.zonesAws : t.probe.zones, ...probe.zones },
  ];
  return (
    <ul className="space-y-1 rounded border border-ink-800 bg-ink-950 p-2.5">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
          <span className={r.ok ? 'text-accent' : 'text-danger'}>{r.ok ? t.probe.ok : t.probe.refused}</span>
          <code className="text-ink-300">{r.label}</code>
          <span className="min-w-0 break-words text-ink-400">{r.note}</span>
        </li>
      ))}
    </ul>
  );
}

function probeOf(err: unknown): ProviderProbe | null {
  if (!(err instanceof ApiClientError)) return null;
  const detail = err.body?.detail as ProviderProbe | undefined;
  return detail && typeof detail === 'object' && 'identity' in detail ? detail : null;
}

/* ----------------------------------------------------- hosts other than AWS */

const OVH_TOKEN_HOSTS: Record<string, string> = {
  'ovh-eu': 'https://eu.api.ovh.com',
  'ovh-ca': 'https://ca.api.ovh.com',
  'ovh-us': 'https://api.us.ovhcloud.com',
};
const OVH_RIGHTS =
  'GET=/domain/zone&GET=/domain/zone/*&POST=/domain/zone/*&PUT=/domain/zone/*&DELETE=/domain/zone/*';

const ext = 'text-accent hover:underline';

/** Where to get the credentials, in as few steps as the host allows. */
function HostSteps({ type, values }: { type: RemoteProviderType; values: Record<string, string> }) {
  const t = useT().providers.hostSteps;
  const list = 'list-decimal space-y-1 pl-5 text-xs leading-relaxed text-ink-300';
  const link = (href: string) => (c: string) => (
    <a href={href} target="_blank" rel="noreferrer" className={ext}>
      {c}
    </a>
  );
  if (type === 'ovh') {
    const url = `${OVH_TOKEN_HOSTS[values.endpoint || 'ovh-eu']}/createToken/?${OVH_RIGHTS}`;
    return (
      <ol className={list}>
        <li>{t.ovh.region}</li>
        <li>{rich(t.ovh.token, { ...tags, a: link(url) })}</li>
        <li>{t.ovh.paste}</li>
      </ol>
    );
  }
  if (type === 'gandi') {
    return (
      <ol className={list}>
        <li>
          {rich(t.gandi.navigate, {
            ...tags,
            a: link('https://admin.gandi.net/organizations/account/pat'),
          })}
        </li>
        <li>{rich(t.gandi.scope, tags)}</li>
        <li>{t.gandi.paste}</li>
      </ol>
    );
  }
  if (type === 'godaddy') {
    return (
      <ol className={list}>
        <li>{rich(t.godaddy.navigate, { ...tags, a: link('https://developer.godaddy.com/keys') })}</li>
        <li>{t.godaddy.paste}</li>
        <li>{t.godaddy.limit}</li>
      </ol>
    );
  }
  return (
    <ol className={list}>
      <li>{rich(t.gcp.account, tags)}</li>
      <li>{rich(t.gcp.role, tags)}</li>
      <li>{rich(t.gcp.key, tags)}</li>
    </ol>
  );
}

/** Create or edit a provider on a host whose credentials are a few flat fields. */
function RemoteDialog({
  type,
  provider,
  onClose,
  onSaved,
}: {
  type: RemoteProviderType;
  provider?: ProviderResource;
  onClose: () => void;
  onSaved: () => void;
}) {
  const messages = useT();
  const t = messages.providers;
  const info = localizeProvider(messages, PROVIDER_INFO[type]);
  const [name, setName] = useState(provider?.name ?? '');
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = { ...(provider?.settings ?? {}) };
    for (const f of info.fields) {
      if (f.options && !initial[f.key]) initial[f.key] = f.options[0].value;
    }
    return initial;
  });
  const [probe, setProbe] = useState<ProviderProbe | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setProbe(null);
  };
  // Blank fields are left out: on an edit that means "keep the stored value".
  const settings = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== ''));

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError((err as Error).message);
      const detail = probeOf(err);
      if (detail) setProbe(detail);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    const res = await run(() =>
      api<ProviderProbe>('/api/admin/providers/probe', {
        method: 'POST',
        body: JSON.stringify({ type, provider_id: provider?.id, settings }),
      }),
    );
    if (res) setProbe(res);
  }

  async function save(force: boolean) {
    const res = await run(() =>
      provider
        ? api<ProviderResource>(`/api/admin/providers/${provider.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name: name.trim(), settings }),
          })
        : api<ProviderResource>(`/api/admin/providers${force ? '?force=true' : ''}`, {
            method: 'POST',
            body: JSON.stringify({ name: name.trim(), type, settings }),
          }),
    );
    if (res) onSaved();
  }

  const complete = info.fields.every((f) => !f.required || provider || values[f.key]?.trim());
  const typed = Boolean(name !== (provider?.name ?? '') || info.fields.some((f) => f.secret && values[f.key]));

  return (
    <Modal
      title={
        provider
          ? fmt(t.remote.editTitle, { name: provider.name })
          : fmt(t.remote.newTitle, { label: info.label })
      }
      onClose={onClose}
      guard={typed ? t.remote.closeGuard : null}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
        className="space-y-3"
      >
        <HostSteps type={type} values={values} />
        <p className="text-xs text-ink-400">
          {rich(fmt(t.remote.details, { label: info.label }), {
            a: (c) => (
              <Link href={`/admin/docs/${info.docs}`} className={ext}>
                {c}
              </Link>
            ),
          })}
        </p>

        <Field label={t.remote.nameLabel} hint={t.remote.nameHint}>
          <Input
            required
            autoFocus={!provider}
            autoComplete="off"
            data-1p-ignore
            placeholder={`${type}-perso`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        {info.fields.map((f) => (
          <Field
            key={f.key}
            label={f.required ? f.label : fmt(t.remote.optionalLabel, { label: f.label })}
            hint={
              provider && f.secret
                ? t.remote.keepHint
                : f.secret
                  ? f.hint
                    ? fmt(t.remote.secretHintWith, { hint: f.hint })
                    : t.remote.secretHint
                  : f.hint
            }
          >
            {f.options ? (
              <Select value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : f.multiline ? (
              <textarea
                required={f.required && !provider}
                rows={6}
                spellCheck={false}
                autoComplete="off"
                data-1p-ignore
                placeholder={f.placeholder}
                value={values[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-ink-100 outline-none placeholder:text-ink-600 focus:border-accent"
              />
            ) : (
              <Input
                required={f.required && !provider}
                type={f.secret ? 'password' : 'text'}
                autoComplete={f.secret ? 'new-password' : 'off'}
                data-1p-ignore
                placeholder={f.placeholder}
                value={values[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </Field>
        ))}

        {probe && <ProbeReport probe={probe} />}
        <ErrorNote>{error}</ErrorNote>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" disabled={busy || !complete} onClick={test}>
            {busy ? t.remote.testing : probe ? t.remote.retest : t.remote.test}
          </Button>
          {!provider && probe && !probe.ok && (
            <Button type="button" variant="danger" disabled={busy} onClick={() => save(true)}>
              {t.remote.saveAnyway}
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !name.trim() || !complete || (!provider && !probe?.ok)}
          >
            {t.remote.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** First screen of a creation: which DNS host. */
function ChooseHost({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (type: (typeof PROVIDER_TYPES)[number]) => void;
}) {
  const messages = useT();
  const t = messages.providers;
  return (
    <Modal title={t.choose.title} onClose={onClose}>
      <ul className="space-y-2">
        {PROVIDER_TYPES.map((type) => {
          const info = localizeProvider(messages, PROVIDER_INFO[type]);
          return (
            <li key={type}>
              <button
                type="button"
                onClick={() => onPick(type)}
                className="flex w-full items-center gap-3 rounded-md border border-ink-700 bg-ink-950 px-3 py-2.5 text-left transition-colors hover:border-accent"
              >
                <ProviderLogo type={type} size={32} />
                <span className="flex-1 text-sm font-semibold text-ink-100">{info.label}</span>
                <span className="text-xs text-ink-400">{info.product}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

/* ------------------------------------------------------------- creation */

type Policies = ProviderProbe['policies'];

const ROLE_NAME = 'local-cert-dns';
const POLICY_NAME = 'local-cert-route53';

/** A name the operator has to type into AWS: shown copyable, never just mentioned. */
function Name({ value }: { value: string }) {
  return (
    <span className="inline-block rounded border border-ink-700 bg-ink-950 px-1.5 align-middle">
      <Copyable value={value} />
    </span>
  );
}

/**
 * Three screens, one AWS object each: the IAM user, the role, the permissions.
 *
 * The provider is stored as a draft as soon as the key pair is verified, so
 * closing the dialog — or the tab — loses nothing: "reprendre" in the list
 * reopens it at the step that was reached. Each document to paste sits under
 * the instruction that asks for it.
 */
function CreateWizard({
  draft,
  onClose,
  onChanged,
  onSaved,
}: {
  /** an existing draft to resume */
  draft?: ProviderResource;
  onClose: () => void;
  /** the draft was created or updated: the list behind should refresh */
  onChanged: () => void;
  onSaved: () => void;
}) {
  const t = useT().providers;
  const [provider, setProvider] = useState<ProviderResource | null>(draft ?? null);
  const [step, setStep] = useState(draft ? (draft.role_arn ? 2 : 1) : 0);
  const [name, setName] = useState('');
  const [ambient, setAmbient] = useState(false);
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [useRole, setUseRole] = useState(true);
  const [roleArn, setRoleArn] = useState(draft?.role_arn ?? '');
  const [policies, setPolicies] = useState<Policies | null>(null);
  const [probe, setProbe] = useState<ProviderProbe | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedRole = (account: string | null) =>
    account ? `arn:aws:iam::${account}:role/${ROLE_NAME}` : '';

  // Resuming: the documents are derived from the stored key pair, so they are
  // regenerated rather than kept anywhere.
  useEffect(() => {
    if (!draft) return;
    let stale = false;
    api<ProviderProbe>('/api/admin/providers/probe', {
      method: 'POST',
      body: JSON.stringify({ provider_id: draft.id, role_arn: null }),
    })
      .then((res) => {
        if (stale) return;
        setPolicies(res.policies);
        if (!draft.role_arn) setRoleArn(suggestedRole(res.identity.account));
      })
      .catch((err) => {
        if (!stale) setError((err as Error).message);
      });
    return () => {
      stale = true;
    };
  }, [draft]);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError((err as Error).message);
      const detail = probeOf(err);
      if (detail && step === 2) setProbe(detail);
    } finally {
      setBusy(false);
    }
  }

  async function createDraft(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(() =>
      api<ProviderResource & { probe: ProviderProbe }>('/api/admin/providers', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          type: 'aws',
          draft: true,
          ...(ambient
            ? {}
            : { access_key_id: accessKeyId.trim(), secret_access_key: secret.trim() }),
        }),
      }),
    );
    if (!res) return;
    setProvider(res);
    setPolicies(res.probe.policies);
    setRoleArn(suggestedRole(res.account_id));
    setSecret('');
    setStep(1);
    onChanged();
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    if (!provider) return;
    const res = await run(() =>
      api<ProviderResource>(`/api/admin/providers/${provider.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role_arn: useRole ? roleArn.trim() : null }),
      }),
    );
    if (!res) return;
    setProvider(res);
    setProbe(null);
    setStep(2);
    onChanged();
  }

  async function test() {
    if (!provider) return;
    const res = await run(() =>
      api<ProviderProbe>('/api/admin/providers/probe', {
        method: 'POST',
        body: JSON.stringify({ provider_id: provider.id }),
      }),
    );
    if (res) setProbe(res);
  }

  async function finalise(force: boolean) {
    if (!provider) return;
    const res = await run(() =>
      api<ProviderResource>(`/api/admin/providers/${provider.id}${force ? '?force=true' : ''}`, {
        method: 'PATCH',
        body: JSON.stringify({ draft: false }),
      }),
    );
    if (res) onSaved();
  }

  const typed = Boolean(name || accessKeyId || secret);
  const guard = provider
    ? fmt(t.wizard.guardDraft, { name: provider.name })
    : typed
      ? t.wizard.guardTyped
      : null;
  const onRole = Boolean(provider?.role_arn);

  return (
    <Modal
      title={provider ? fmt(t.wizard.titleNamed, { name: provider.name }) : t.wizard.title}
      onClose={onClose}
      guard={guard}
      wide
    >
      <Stepper
        steps={[t.wizard.steps.user, t.wizard.steps.role, t.wizard.steps.permissions]}
        current={step}
      />

      {step === 0 && (
        <form onSubmit={createDraft} className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-ink-300">
            <li>{rich(t.wizard.user.create, { ...tags, name: <Name value="local-cert" /> })}</li>
            <li>{rich(t.wizard.user.key, tags)}</li>
            <li>{t.wizard.user.paste}</li>
          </ol>

          <Field label={t.wizard.user.nameLabel} hint={t.wizard.user.nameHint}>
            <Input
              required
              autoFocus
              autoComplete="off"
              data-1p-ignore
              placeholder="aws-prod"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          {!ambient && (
            <>
              <Field label={t.wizard.user.accessKeyId}>
                <Input
                  required
                  autoComplete="off"
                  data-1p-ignore
                  placeholder="AKIA…"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                />
              </Field>
              <Field label={t.wizard.user.secretKey} hint={t.wizard.user.secretKeyHint}>
                <Input
                  required
                  type="password"
                  autoComplete="new-password"
                  data-1p-ignore
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
              </Field>
            </>
          )}

          <label className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-400">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={ambient}
              onChange={(e) => setAmbient(e.target.checked)}
            />
            <span>{t.wizard.user.ambient}</span>
          </label>

          <p className="text-[11px] leading-relaxed text-ink-400">
            {rich(t.wizard.user.draftNote, tags)}
          </p>

          <ErrorNote>{error}</ErrorNote>
          <div className="flex justify-end gap-2">
            <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
              {busy ? t.wizard.user.verifying : t.wizard.user.verify}
            </Button>
          </div>
        </form>
      )}

      {step === 1 && provider && (
        <form onSubmit={saveRole} className="space-y-3">
          <p className="text-xs leading-relaxed text-ink-300">
            {rich(t.wizard.role.valid, {
              identity: <code className="break-all text-accent">{provider.principal_arn ?? '—'}</code>,
            })}
          </p>

          <label className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-400">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={useRole}
              onChange={(e) => setUseRole(e.target.checked)}
            />
            <span>{t.wizard.role.useRole}</span>
          </label>

          {useRole ? (
            <ol className="list-decimal space-y-3 pl-5 text-xs leading-relaxed text-ink-300">
              <li>
                {rich(t.wizard.role.trust, tags)}
                <div className="mt-2">
                  {policies?.trust ? (
                    <CodeBlock title={t.wizard.role.trustTitle} code={json(policies.trust)} />
                  ) : (
                    <p className="text-ink-400">{t.wizard.role.trustLoading}</p>
                  )}
                </div>
              </li>
              <li>{rich(t.wizard.role.noPermissions, tags)}</li>
              <li>{rich(t.wizard.role.roleName, { ...tags, name: <Name value={ROLE_NAME} /> })}</li>
              <li>
                {rich(t.wizard.role.copyArn, tags)}
                <div className="mt-2">
                  <Input
                    required
                    autoComplete="off"
                    data-1p-ignore
                    aria-label={t.wizard.role.arnAria}
                    placeholder={`arn:aws:iam::123456789012:role/${ROLE_NAME}`}
                    value={roleArn}
                    onChange={(e) => setRoleArn(e.target.value)}
                  />
                  <span className="mt-1 block text-[11px] text-ink-400">
                    {t.wizard.role.arnHint}
                  </span>
                </div>
              </li>
            </ol>
          ) : (
            <p className="text-xs leading-relaxed text-ink-300">
              {t.wizard.role.noRole}
            </p>
          )}

          <ErrorNote>{error}</ErrorNote>
          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={busy || (useRole && !roleArn.trim())}
            >
              {busy ? t.wizard.role.saving : t.wizard.role.next}
            </Button>
          </div>
        </form>
      )}

      {step === 2 && provider && (
        <div className="space-y-3">
          <ol className="list-decimal space-y-3 pl-5 text-xs leading-relaxed text-ink-300">
            <li>
              {rich(t.wizard.permissions.open, {
                ...tags,
                section: onRole ? <b>{t.wizard.permissions.roles}</b> : <b>{t.wizard.permissions.users}</b>,
                target: (
                  <code className="break-all text-ink-100">
                    {onRole
                      ? provider.role_arn
                      : (provider.principal_arn ?? t.wizard.permissions.yourUser)}
                  </code>
                ),
              })}
            </li>
            <li>
              {rich(t.wizard.permissions.json, tags)}
              <div className="mt-2">
                {policies ? (
                  <CodeBlock
                    title={t.wizard.permissions.policyTitle}
                    code={json(policies.permissions)}
                  />
                ) : (
                  <p className="text-ink-400">{t.wizard.permissions.policyLoading}</p>
                )}
              </div>
            </li>
            <li>
              {rich(t.wizard.permissions.save, { ...tags, name: <Name value={POLICY_NAME} /> })}
            </li>
            <li>{t.wizard.permissions.test}</li>
          </ol>

          <p className="text-[11px] leading-relaxed text-ink-400">
            {t.wizard.permissions.note}
          </p>

          {probe && <ProbeReport probe={probe} />}
          <ErrorNote>{error}</ErrorNote>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep(1);
                setUseRole(onRole);
                setProbe(null);
                setError(null);
              }}
            >
              {t.actions.back}
            </Button>
            <Button type="button" disabled={busy} onClick={test}>
              {busy
                ? t.wizard.permissions.testing
                : probe
                  ? t.wizard.permissions.retest
                  : t.wizard.permissions.testButton}
            </Button>
            {probe && !probe.ok && (
              <Button type="button" variant="danger" disabled={busy} onClick={() => finalise(true)}>
                {t.wizard.permissions.saveAnyway}
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              disabled={busy || !probe?.ok}
              onClick={() => finalise(false)}
            >
              {t.wizard.permissions.save2}
            </Button>
          </div>
          {probe && !probe.ok && (
            <p className="text-[11px] leading-relaxed text-ink-400">
              {t.wizard.permissions.propagation}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ----------------------------------------------------------------- edit */

function EditDialog({
  provider,
  onClose,
  onSaved,
}: {
  provider: ProviderResource;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT().providers;
  const [name, setName] = useState(provider.name);
  const [roleArn, setRoleArn] = useState(provider.role_arn ?? '');
  const [rotate, setRotate] = useState(false);
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [probe, setProbe] = useState<ProviderProbe | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keys = rotate
    ? { access_key_id: accessKeyId.trim(), secret_access_key: secret.trim() }
    : {};
  const role = roleArn.trim() || null;

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    const res = await run(() =>
      api<ProviderProbe>('/api/admin/providers/probe', {
        method: 'POST',
        body: JSON.stringify({ provider_id: provider.id, ...keys, role_arn: role }),
      }),
    );
    if (res) setProbe(res);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(() =>
      api<ProviderResource & { probe?: ProviderProbe }>(`/api/admin/providers/${provider.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), ...keys, role_arn: role }),
      }),
    );
    if (res) onSaved();
  }

  return (
    <Modal title={fmt(t.edit.title, { name: provider.name })} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label={t.edit.name}>
          <Input
            required
            autoComplete="off"
            data-1p-ignore
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t.edit.roleArn} hint={t.edit.roleArnHint}>
          <Input
            autoComplete="off"
            data-1p-ignore
            placeholder="arn:aws:iam::123456789012:role/local-cert-dns"
            value={roleArn}
            onChange={(e) => {
              setRoleArn(e.target.value);
              setProbe(null);
            }}
          />
        </Field>

        <label className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-400">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={rotate}
            onChange={(e) => {
              setRotate(e.target.checked);
              setProbe(null);
            }}
          />
          <span>
            {fmt(t.edit.rotate, {
              current: provider.access_key_id
                ? fmt(t.edit.rotateCurrent, { id: provider.access_key_id })
                : '',
            })}
          </span>
        </label>
        {rotate && (
          <>
            <Field label={t.edit.accessKeyId}>
              <Input
                required
                autoComplete="off"
                data-1p-ignore
                placeholder="AKIA…"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
              />
            </Field>
            <Field label={t.edit.secretKey}>
              <Input
                required
                type="password"
                autoComplete="new-password"
                data-1p-ignore
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </Field>
          </>
        )}

        {probe && <ProbeReport probe={probe} />}
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.actions.cancel}
          </Button>
          <Button type="button" disabled={busy} onClick={test}>
            {busy ? t.edit.testing : t.edit.test}
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            {t.edit.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------------- policy */

function PolicyDialog({ provider, onClose }: { provider: ProviderResource; onClose: () => void }) {
  const t = useT().providers;
  const [data, setData] = useState<ProviderPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ProviderPolicy>(`/api/admin/providers/${provider.id}/policy`)
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }, [provider.id]);

  return (
    <Modal title={fmt(t.policy.title, { name: provider.name })} onClose={onClose} wide>
      <div className="space-y-3">
        <ErrorNote>{error}</ErrorNote>
        {!data && !error && <p className="text-xs text-ink-400">{t.policy.generating}</p>}
        {data && (
          <>
            <p className="text-xs leading-relaxed text-ink-300">
              {rich(plural(data.zone_ids.length, t.policy.introOne, t.policy.intro), {
                target: data.attach_to?.kind === 'role' ? t.policy.targetRole : t.policy.targetUser,
                arn: data.attach_to?.arn && <code className="text-ink-100">{data.attach_to.arn}</code>,
              })}
            </p>
            {provider.managed !== 'env' && (
              <p className="text-[11px] leading-relaxed text-ink-400">
                {rich(t.policy.removeBlocks, tags)}
              </p>
            )}
            {data.policy && (
              <CodeBlock title={t.policy.codeTitle} code={json(data.policy)} />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- remove */

type Cleanup = NonNullable<ProviderDeleteResult['cleanup']>;

function cleanupOf(err: unknown): Cleanup | null {
  if (!(err instanceof ApiClientError)) return null;
  const detail = err.body?.detail as Cleanup | undefined;
  return detail && typeof detail === 'object' && 'steps' in detail ? detail : null;
}

function CleanupReport({ report }: { report: Cleanup }) {
  const t = useT().providers;
  return (
    <ul className="space-y-1 rounded border border-ink-800 bg-ink-950 p-2.5">
      {report.steps.map((s) => (
        <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
          <span className={s.ok ? 'text-accent' : 'text-danger'}>{s.ok ? t.remove.ok : t.remove.failed}</span>
          <code className="text-ink-300">{s.label}</code>
          <span className="min-w-0 break-words text-ink-400">{s.note}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Removing a provider, optionally undoing its AWS side first. The clean-up is
 * only offered where it can work: an AWS provider with its own key pair, whose
 * IAM user and role no other provider relies on.
 */
function RemoveDialog({
  provider,
  all,
  onClose,
  onRemoved,
}: {
  provider: ProviderResource;
  all: ProviderResource[];
  onClose: () => void;
  onRemoved: () => void;
}) {
  const t = useT().providers;
  const [cleanup, setCleanup] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Cleanup | null>(null);
  const [removed, setRemoved] = useState(false);

  const isAws = provider.type === 'aws';
  const shared = all.filter(
    (o) =>
      o.id !== provider.id &&
      o.type === 'aws' &&
      ((provider.access_key_id !== null && o.access_key_id === provider.access_key_id) ||
        (provider.principal_arn !== null && o.principal_arn === provider.principal_arn) ||
        (provider.role_arn !== null && o.role_arn === provider.role_arn)),
  );
  const canCleanup = isAws && provider.credentials === 'static' && shared.length === 0;
  const userName = provider.principal_arn?.split('/').pop() ?? t.remove.userFallback;
  const roleName = provider.role_arn?.split('/').pop() ?? null;

  async function remove() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const res = await api<ProviderDeleteResult>(
        `/api/admin/providers/${provider.id}${cleanup ? '?cleanup=true' : ''}`,
        { method: 'DELETE' },
      );
      if (res.cleanup) {
        setReport(res.cleanup);
        setRemoved(true);
      } else {
        onRemoved();
      }
    } catch (err) {
      setError((err as Error).message);
      setReport(cleanupOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (removed && report) {
    return (
      <Modal title={fmt(t.remove.removedTitle, { name: provider.name })} onClose={onRemoved} wide>
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-ink-300">
            {report.ok ? t.remove.cleanOk : t.remove.cleanPartial}
          </p>
          <CleanupReport report={report} />
          {report.leftovers.length > 0 && (
            <>
              <p className="text-xs leading-relaxed text-ink-300">
                {report.ok ? t.remove.leftoversOk : t.remove.leftoversPartial}
              </p>
              <CodeBlock title="AWS CLI" code={report.leftovers.join('\n')} />
            </>
          )}
          <div className="flex justify-end">
            <Button variant="primary" onClick={onRemoved}>
              {t.actions.close}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={fmt(t.remove.title, { name: provider.name })} onClose={onClose} wide={canCleanup}>
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-ink-300">
          {t.remove.intro}
          {!cleanup && isAws && t.remove.awsUntouched}
        </p>

        {canCleanup && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded border border-ink-700 px-2.5 py-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={cleanup}
              onChange={(e) => setCleanup(e.target.checked)}
            />
            <span className="min-w-0 leading-relaxed">
              <span className="text-ink-100">{t.remove.cleanupLabel}</span>
              <span className="block text-ink-400">
                {roleName
                  ? rich(t.remove.cleanupWithRole, {
                      code: (c) => <code>{c}</code>,
                      user: <code>{userName}</code>,
                      role: <code>{roleName}</code>,
                    })
                  : rich(t.remove.cleanupNoRole, { user: <code>{userName}</code> })}{' '}
                {rich(t.remove.cleanupTail, tags)}
              </span>
            </span>
          </label>
        )}
        {isAws && shared.length > 0 && (
          <p className="text-[11px] leading-relaxed text-ink-400">
            {fmt(shared.length > 1 ? t.remove.sharedMany : t.remove.sharedOne, {
              names: shared.map((o) => o.name).join(', '),
            })}
          </p>
        )}

        <Field label={fmt(t.remove.confirm, { name: provider.name })}>
          <Input
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </Field>

        <ErrorNote>{error}</ErrorNote>
        {report && <CleanupReport report={report} />}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.actions.cancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={busy || typed.trim() !== provider.name}
            onClick={remove}
          >
            {busy ? '…' : cleanup ? t.remove.removeAndClean : t.remove.remove}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- page */

export function ProvidersClient({ initial }: { initial: ProviderResource[] }) {
  const t = useT().providers;
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [probes, setProbes] = useState<Record<string, ProviderProbe>>({});

  function saved() {
    setDialog(null);
    router.refresh();
  }

  async function test(p: ProviderResource) {
    setError(null);
    setTesting(p.id);
    try {
      const res = await api<ProviderProbe>('/api/admin/providers/probe', {
        method: 'POST',
        body: JSON.stringify({ provider_id: p.id }),
      });
      setProbes((prev) => ({ ...prev, [p.id]: res }));
    } catch (err) {
      setError(`${p.name}: ${(err as Error).message}`);
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-5">
      <Panel
        title={t.list.title}
        action={
          <Button variant="primary" onClick={() => setDialog({ kind: 'choose' })}>
            {t.list.add}
          </Button>
        }
      >
        {initial.length === 0 ? (
          <p className="py-4 text-center text-xs leading-relaxed text-ink-400">
            {t.list.empty}
          </p>
        ) : (
          <Table head={[
              t.list.head.name,
              t.list.head.type,
              t.list.head.account,
              t.list.head.identity,
              t.list.head.domains,
              '',
            ]}>
            {initial.map((p) => (
              <tr key={p.id} className="border-b border-ink-800 align-top last:border-0">
                <td className="whitespace-nowrap px-2 py-2 text-ink-100">
                  {p.name}
                  {p.draft && (
                    <span className="ml-2 rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[11px] text-warn">
                      {t.list.draft}
                    </span>
                  )}
                  {p.managed === 'env' && (
                    <span
                      className="ml-2 rounded border border-info/40 bg-info/10 px-1.5 py-0.5 text-[11px] text-info"
                      title={fmt(t.list.envTitle, { type: p.type.toUpperCase(), key: p.env_key ?? '' })}
                    >
                      {t.list.env}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-ink-300">
                  <span className="inline-flex items-center gap-1.5">
                    <ProviderLogo type={p.type} size={18} />
                    {PROVIDER_INFO[p.type].label}
                  </span>
                </td>
                <td className="px-2 py-2 text-ink-300">
                  {p.account_id ? <Copyable value={p.account_id} /> : '—'}
                </td>
                <td className="px-2 py-2">
                  <div className="break-all text-ink-300">
                    {p.type !== 'aws'
                      ? Object.values(p.settings).join(' · ') || t.list.storedCredentials
                      : p.credentials === 'static'
                        ? p.access_key_id
                        : t.list.processCredentials}
                  </div>
                  {p.role_arn && (
                    <div className="break-all text-[11px] text-ink-400">{fmt(t.list.assume, { arn: p.role_arn })}</div>
                  )}
                  {probes[p.id] && (
                    <div className="mt-1.5">
                      <ProbeReport probe={probes[p.id]} />
                    </div>
                  )}
                </td>
                <td className="px-2 py-2 tabular-nums text-ink-300">{p.domain_count}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {p.draft ? (
                      <Button variant="primary" onClick={() => setDialog({ kind: 'create', draft: p })}>
                        {t.actions.resume}
                      </Button>
                    ) : (
                      <>
                        <Button disabled={testing === p.id} onClick={() => test(p)}>
                          {testing === p.id ? '…' : t.actions.test}
                        </Button>
                        {p.type === 'aws' && (
                          <Button onClick={() => setDialog({ kind: 'policy', provider: p })}>
                            {t.actions.policy}
                          </Button>
                        )}
                        {!p.managed && (
                          <Button
                            onClick={() =>
                              setDialog(
                                p.type === 'aws'
                                  ? { kind: 'edit', provider: p }
                                  : { kind: 'remote', type: p.type, provider: p },
                              )
                            }
                          >
                            {t.actions.edit}
                          </Button>
                        )}
                      </>
                    )}
                    {!p.managed && (
                      <Button variant="danger" onClick={() => setDialog({ kind: 'remove', provider: p })}>
                        {t.actions.remove}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      </Panel>

      <p className="text-[11px] leading-relaxed text-ink-400">
        {rich(t.list.footer, {
          ...tags,
          a: (c) => (
            <Link href="/admin/docs/providers" className="text-accent hover:underline">
              {c}
            </Link>
          ),
        })}
      </p>

      {dialog?.kind === 'choose' && (
        <ChooseHost
          onClose={() => setDialog(null)}
          onPick={(type) => setDialog(type === 'aws' ? { kind: 'create' } : { kind: 'remote', type })}
        />
      )}
      {dialog?.kind === 'remote' && (
        <RemoteDialog
          type={dialog.type}
          provider={dialog.provider}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.kind === 'create' && (
        <CreateWizard
          draft={dialog.draft}
          onClose={() => setDialog(null)}
          onChanged={() => router.refresh()}
          onSaved={saved}
        />
      )}
      {dialog?.kind === 'edit' && (
        <EditDialog provider={dialog.provider} onClose={() => setDialog(null)} onSaved={saved} />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveDialog
          provider={dialog.provider}
          all={initial}
          onClose={() => setDialog(null)}
          onRemoved={saved}
        />
      )}
      {dialog?.kind === 'policy' && (
        <PolicyDialog provider={dialog.provider} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

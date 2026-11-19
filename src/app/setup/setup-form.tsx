'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { fmt, rich } from '@/lib/i18n/format';
import { Button, Copyable, ErrorNote, Field, Input, Panel, api } from '@/components/ui';

interface Policy {
  enforced: boolean;
  minLength: number;
  requiredClasses: number;
  description: string;
}

interface Created {
  email: string;
  api_key: string;
  api_key_minted: boolean;
}

export function SetupForm() {
  const router = useRouter();
  const t = useT();
  const [form, setForm] = useState({
    email: '',
    password: '',
    password_confirm: '',
    api_key: '',
  });
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [environment, setEnvironment] = useState<string | null>(null);

  // The policy lives on the server, driven by APP_ENV — the form only mirrors it.
  useEffect(() => {
    void fetch('/api/setup')
      .then((r) => r.json())
      .then((d) => {
        setPolicy(d.password_policy ?? null);
        setEnvironment(d.environment ?? null);
      })
      .catch(() => {});
  }, []);

  const classCount = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(form.password),
  ).length;
  const policyOk =
    !policy?.enforced ||
    (form.password.length >= policy.minLength && classCount >= policy.requiredClasses);

  const mismatch =
    form.password_confirm.length > 0 && form.password !== form.password_confirm;
  const canSubmit =
    form.email.includes('@') &&
    form.password.length > 0 &&
    policyOk &&
    !mismatch &&
    (!useOwnKey || form.api_key.trim().length >= 24);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<Created>('/api/setup', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          password_confirm: form.password_confirm,
          ...(useOwnKey && form.api_key.trim() ? { api_key: form.api_key.trim() } : {}),
        }),
      });
      setCreated(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Panel title={t.auth.setup.createdTitle}>
        <p className="text-xs text-ink-300">
          {rich(t.auth.setup.createdBody, {
            email: <span className="text-accent">{created.email}</span>,
          })}
        </p>
        {created.api_key_minted && (
          <>
            <p className="mt-4 text-[11px] text-ink-400">
              {t.auth.setup.keyShownOnce}
            </p>
            <div className="mt-1.5 rounded border border-accent/40 bg-ink-950 px-3 py-2">
              <Copyable value={created.api_key} />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-600">
              {rich(fmt(t.auth.setup.keyNote, { email: created.email }), {
                code: (c) => <code>{c}</code>,
              })}
            </p>
          </>
        )}
        <Button
          variant="primary"
          className="mt-4 w-full"
          onClick={() => {
            router.replace('/admin');
            router.refresh();
          }}
        >
          {t.auth.setup.openConsole}
        </Button>
      </Panel>
    );
  }

  return (
    <Panel title={t.auth.setup.accountTitle}>
      <form onSubmit={submit} className="space-y-3">
        <Field label={t.auth.setup.email}>
          <Input
            type="email"
            required
            autoFocus
            autoComplete="username"
            placeholder="admin@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>

        <Field label={t.auth.setup.password} hint={
            policy
              ? policy.enforced
                ? fmt(t.auth.policy.rules, {
                    minLength: policy.minLength,
                    requiredClasses: policy.requiredClasses,
                  })
                : t.auth.policy.none
              : undefined
          }>
          <Input
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label={t.auth.setup.confirmation}>
          <Input
            type="password"
            required
            autoComplete="new-password"
            value={form.password_confirm}
            onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
          />
        </Field>
        {policy?.enforced && form.password.length > 0 && !policyOk && (
          <p className="text-[11px] text-warn">
            {form.password.length < policy.minLength
              ? fmt(t.auth.setup.moreChars, { count: policy.minLength - form.password.length })
              : fmt(t.auth.setup.moreClasses, { count: policy.requiredClasses - classCount })}
          </p>
        )}

        {mismatch && <p className="text-[11px] text-danger">{t.auth.setup.mismatch}</p>}

        <label className="flex items-center gap-2 border-t border-ink-800 pt-3 text-xs text-ink-300">
          <input
            type="checkbox"
            checked={useOwnKey}
            onChange={(e) => setUseOwnKey(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          {t.auth.setup.ownKey}
        </label>
        {useOwnKey ? (
          <Field label={t.auth.setup.apiKey} hint={t.auth.setup.apiKeyHint}>
            <Input
              type="password"
              autoComplete="off"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            />
          </Field>
        ) : (
          <p className="text-[11px] text-ink-600">
            {t.auth.setup.generated}
          </p>
        )}

        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" variant="primary" disabled={busy || !canSubmit} className="w-full">
          {busy ? t.auth.setup.creating : t.auth.setup.create}
        </Button>
        <p className="text-[11px] leading-relaxed text-ink-600">
          {rich(t.auth.setup.once, { code: (c) => <code>{c}</code> })}
        </p>
      </form>
    </Panel>
  );
}

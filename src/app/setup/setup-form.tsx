'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
      <Panel title="Compte créé">
        <p className="text-xs text-ink-300">
          Compte administrateur <span className="text-accent">{created.email}</span> créé. Vous êtes
          déjà connecté.
        </p>
        {created.api_key_minted && (
          <>
            <p className="mt-4 text-[11px] uppercase tracking-wider text-ink-400">
              Clé d&apos;API — affichée une seule fois
            </p>
            <div className="mt-1.5 rounded border border-accent/40 bg-ink-950 px-3 py-2">
              <Copyable value={created.api_key} />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-600">
              Seul son hash est en base. Notez-la maintenant : elle n&apos;est plus récupérable.
              Perdue ⇒ <code>npx tsx scripts/reset-admin.ts {created.email} &lt;mot-de-passe&gt;</code>.
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
          Ouvrir la console
        </Button>
      </Panel>
    );
  }

  return (
    <Panel title="Compte administrateur">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email">
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

        <Field label="Mot de passe" hint={policy?.description}>
          <Input
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="Confirmation">
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
              ? `Encore ${policy.minLength - form.password.length} caractère(s).`
              : `Encore ${policy.requiredClasses - classCount} catégorie(s) de caractères.`}
          </p>
        )}

        {mismatch && <p className="text-[11px] text-danger">Les mots de passe diffèrent.</p>}

        <label className="flex items-center gap-2 border-t border-ink-800 pt-3 text-xs text-ink-300">
          <input
            type="checkbox"
            checked={useOwnKey}
            onChange={(e) => setUseOwnKey(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          Fournir ma propre clé d&apos;API
        </label>
        {useOwnKey ? (
          <Field label="Clé d’API" hint="24 caractères minimum — stockée hachée, jamais réaffichée">
            <Input
              type="password"
              autoComplete="off"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            />
          </Field>
        ) : (
          <p className="text-[11px] text-ink-600">
            Une clé sera générée et affichée une seule fois à l&apos;étape suivante.
          </p>
        )}

        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" variant="primary" disabled={busy || !canSubmit} className="w-full">
          {busy ? 'Création…' : 'Créer le compte'}
        </Button>
        <p className="text-[11px] leading-relaxed text-ink-600">
          Cette page ne s&apos;affiche qu&apos;une fois. Pour automatiser, définissez
          <code> ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code> et éventuellement
          <code> ADMIN_API_KEY</code> avant le premier démarrage.
        </p>
      </form>
    </Panel>
  );
}

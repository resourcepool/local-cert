'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { Button, ErrorNote, Field, Input, Panel, api } from '@/components/ui';

export function LoginForm() {
  const router = useRouter();
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/admin/session', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.replace('/admin');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Panel title={t.auth.login.title}>
      <form onSubmit={submit} className="space-y-3">
        <Field label={t.auth.login.email}>
          <Input
            type="email"
            autoFocus
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={t.auth.login.password}>
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <Button
          type="submit"
          variant="primary"
          disabled={busy || !email || !password}
          className="w-full"
        >
          {busy ? t.auth.login.checking : t.auth.login.submit}
        </Button>
      </form>
    </Panel>
  );
}

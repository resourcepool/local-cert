'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Copyable, ErrorNote, Field, Input, Modal, Panel, api } from '@/components/ui';
import { DOMAIN_SCOPES } from '@/lib/scopes';
import { useT } from '@/lib/i18n/client';
import { fmt, plural, rich } from '@/lib/i18n/format';
import type { AcmeEabCreated, AcmeEabResource } from '@/lib/api/schemas';

export interface KeyView {
  id: string;
  name: string;
  prefix: string;
  opaque: boolean;
  is_own: boolean;
  is_admin: boolean;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  grants: Array<{ domain_id: string; scopes: string[] }>;
}

type DomainRef = { id: string; name: string };
type GrantDraft = Record<string, Set<string>>;

const PRESETS = [
  { key: 'host', scopes: ['cert:read', 'cert:issue', 'cert:renew', 'cert:export'] },
  { key: 'readOnly', scopes: ['cert:read', 'dns:read'] },
  { key: 'dnsOperator', scopes: ['dns:read', 'dns:write'] },
] as const;

const isExpired = (at: string | null) => !!at && new Date(at) < new Date();
/** End of the chosen day, so "expires on the 3rd" still works on the 3rd. */
const endOfDay = (date: string) => new Date(`${date}T23:59:59`).toISOString();

export function KeysClient({
  keys,
  eabKeys,
  domains,
}: {
  keys: KeyView[];
  eabKeys: AcmeEabResource[];
  domains: DomainRef[];
}) {
  const router = useRouter();
  const t = useT();
  const [modal, setModal] = useState<'key' | 'eab' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [eabName, setEabName] = useState('');
  const [eabExpiresAt, setEabExpiresAt] = useState('');
  const [eabDomains, setEabDomains] = useState<Set<string>>(new Set());
  const [mintedEab, setMintedEab] = useState<AcmeEabCreated | null>(null);
  const [name, setName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [draft, setDraft] = useState<GrantDraft>({});
  const [minted, setMinted] = useState<{ name: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  function toggle(domainId: string, scope: string) {
    setDraft((prev) => {
      const next = { ...prev };
      const set = new Set(next[domainId] ?? []);
      if (set.has(scope)) set.delete(scope);
      else set.add(scope);
      next[domainId] = set;
      return next;
    });
  }

  function applyPreset(domainId: string, scopes: string[]) {
    setDraft((prev) => ({ ...prev, [domainId]: new Set(scopes) }));
  }

  function draftToGrants() {
    return Object.entries(draft)
      .filter(([, scopes]) => scopes.size > 0)
      .map(([domain_id, scopes]) => ({ domain_id, scopes: [...scopes] }));
  }

  function openModal(which: 'key' | 'eab') {
    setFormError(null);
    setEditing(null);
    setDraft({});
    setModal(which);
  }

  function closeModal() {
    setModal(null);
    setFormError(null);
    setDraft({});
  }

  async function createEab(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const res = await api<AcmeEabCreated>('/api/v1/acme/eab', {
        method: 'POST',
        body: JSON.stringify({
          name: eabName,
          expires_at: eabExpiresAt ? endOfDay(eabExpiresAt) : null,
          domain_ids: [...eabDomains],
        }),
      });
      setMintedEab(res);
      setEabName('');
      setEabExpiresAt('');
      setEabDomains(new Set());
      setModal(null);
      router.refresh();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function removeEab(id: string, purge: boolean) {
    setError(null);
    try {
      await api(`/api/v1/acme/eab/${id}${purge ? '?purge=true' : ''}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const res = await api<{ name: string; token: string }>('/api/admin/keys', {
        method: 'POST',
        body: JSON.stringify({
          name,
          is_admin: isAdmin,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          grants: isAdmin ? [] : draftToGrants(),
        }),
      });
      setMinted(res);
      setName('');
      setIsAdmin(false);
      setExpiresAt('');
      setDraft({});
      setModal(null);
      router.refresh();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function patch(id: string, body: unknown) {
    setError(null);
    try {
      await api(`/api/admin/keys/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function destroy(id: string) {
    setError(null);
    try {
      await api(`/api/admin/keys/${id}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      {minted && (
        <div className="rounded border border-accent/50 bg-accent/10 p-4">
          <p className="text-xs text-accent">
            {fmt(t.keys.minted.created, { name: minted.name })}
          </p>
          <div className="mt-2 rounded border border-accent/30 bg-ink-950 px-3 py-2">
            <Copyable value={minted.token} />
          </div>
          <Button variant="ghost" className="mt-2" onClick={() => setMinted(null)}>
            {t.keys.minted.ack}
          </Button>
        </div>
      )}

      {mintedEab && (
        <div className="rounded border border-accent/50 bg-accent/10 p-4">
          <p className="text-xs text-accent">
            {fmt(t.keys.mintedEab.created, { name: mintedEab.name })}
          </p>
          <dl className="mt-2 space-y-1.5 rounded border border-accent/30 bg-ink-950 px-3 py-2 text-[11px]">
            {(
              [
                [t.keys.mintedEab.directory, mintedEab.directory_url],
                [t.keys.mintedEab.kid, mintedEab.id],
                [t.keys.mintedEab.hmac, mintedEab.hmac_key],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-baseline gap-x-3">
                <dt className="w-28 shrink-0 text-ink-400">{label}</dt>
                <dd className="min-w-0">
                  <Copyable value={value} />
                </dd>
              </div>
            ))}
          </dl>
          <Button variant="ghost" className="mt-2" onClick={() => setMintedEab(null)}>
            {t.keys.mintedEab.ack}
          </Button>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      <div className="space-y-5">
        <Panel
          title={t.keys.api.title}
          action={
            <Button variant="primary" onClick={() => openModal('key')}>
              {t.keys.api.newKey}
            </Button>
          }
        >
          {keys.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-400">{t.keys.api.empty}</p>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className={`rounded border px-3 py-2.5 ${
                    k.revoked_at ? 'border-ink-800 bg-ink-900/40 opacity-60' : 'border-ink-700 bg-ink-900/60'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-100">{k.name}</span>
                    <code className="rounded border border-ink-700 px-1 text-[11px] text-ink-400">
                      {k.opaque ? `#${k.prefix}` : `lc_${k.prefix}_…`}
                    </code>
                    {k.is_own && (
                      <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent">
                        {t.keys.api.mine}
                      </span>
                    )}
                    {k.is_admin && (
                      <span className="rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[11px] text-warn">
                        {t.keys.api.admin}
                      </span>
                    )}
                    {k.revoked_at && (
                      <span className="rounded border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[11px] text-danger">
                        {t.keys.api.revoked}
                      </span>
                    )}
                    <div className="ml-auto flex gap-1.5">
                      {!k.is_admin && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditing(editing === k.id ? null : k.id);
                            setDraft(
                              Object.fromEntries(k.grants.map((g) => [g.domain_id, new Set(g.scopes)])),
                            );
                          }}
                        >
                          {editing === k.id ? t.keys.api.close : t.keys.api.rights}
                        </Button>
                      )}
                      <Button onClick={() => patch(k.id, { revoked: !k.revoked_at })}>
                        {k.revoked_at ? t.keys.api.reactivate : t.keys.api.revoke}
                      </Button>
                      {!k.is_own && (
                        <Button variant="danger" onClick={() => destroy(k.id)}>
                          {t.keys.api.delete}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-4 text-[11px] text-ink-600">
                    <span>{fmt(t.keys.api.createdOn, { date: k.created_at.slice(0, 10) })}</span>
                    <span>
                      {fmt(t.keys.api.lastUsed, {
                        date: k.last_used_at ? k.last_used_at.slice(0, 16).replace('T', ' ') : t.keys.api.never,
                      })}
                    </span>
                    {k.expires_at && <span>{fmt(t.keys.api.expires, { date: k.expires_at.slice(0, 10) })}</span>}
                  </div>

                  {k.is_admin ? (
                    <p className="mt-2 text-[11px] text-ink-400">
                      {t.keys.api.fullAccess}
                    </p>
                  ) : k.grants.length === 0 ? (
                    <p className="mt-2 text-[11px] text-ink-600">{t.keys.api.noRights}</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {k.grants.map((g) => (
                        <li key={g.domain_id} className="flex flex-wrap items-baseline gap-2 text-[11px]">
                          <span className="text-ink-300">
                            {domains.find((d) => d.id === g.domain_id)?.name ?? t.keys.api.deletedDomain}
                          </span>
                          <span className="text-ink-600">{g.scopes.join(' · ')}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {editing === k.id && (
                    <div className="mt-3 space-y-3 border-t border-ink-800 pt-3">
                      <GrantEditor domains={domains} draft={draft} toggle={toggle} applyPreset={applyPreset} />
                      <Button variant="primary" onClick={() => patch(k.id, { grants: draftToGrants() })}>
                        {t.keys.api.saveRights}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title={t.keys.eab.title}
          action={
            <Button variant="primary" onClick={() => openModal('eab')}>
              {t.keys.eab.newCredential}
            </Button>
          }
        >
          {eabKeys.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-400">
              {rich(t.keys.eab.empty, { code: (c) => <code className="text-ink-300">{c}</code> })}
            </p>
          ) : (
            <div className="space-y-2">
              {eabKeys.map((k) => {
                const expired = isExpired(k.expires_at);
                const dead = !!k.revoked_at || expired;
                return (
                  <div
                    key={k.id}
                    className={`rounded border px-3 py-2.5 ${
                      dead ? 'border-ink-800 bg-ink-900/40 opacity-60' : 'border-ink-700 bg-ink-900/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ink-100">{k.name}</span>
                      <code className="rounded border border-ink-700 px-1 text-[11px] text-ink-400">{k.id}</code>
                      {k.revoked_at ? (
                        <span className="rounded border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[11px] text-danger">
                          {t.keys.eab.revoked}
                        </span>
                      ) : (
                        expired && (
                          <span className="rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[11px] text-warn">
                            {t.keys.eab.expired}
                          </span>
                        )
                      )}
                      <div className="ml-auto flex gap-1.5">
                        {!k.revoked_at && <Button onClick={() => removeEab(k.id, false)}>{t.keys.eab.revoke}</Button>}
                        <Button variant="danger" onClick={() => removeEab(k.id, true)}>
                          {t.keys.eab.delete}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-x-4 text-[11px] text-ink-600">
                      <span>{fmt(t.keys.eab.createdOn, { date: k.created_at.slice(0, 10) })}</span>
                      <span>
                        {fmt(t.keys.eab.lastRegistration, {
                          date: k.last_used_at ? k.last_used_at.slice(0, 16).replace('T', ' ') : t.keys.eab.never,
                        })}
                      </span>
                      <span>
                        {plural(k.accounts, t.keys.eab.accountsOne, t.keys.eab.accountsOther)}
                      </span>
                      {k.expires_at && <span>{fmt(t.keys.eab.expires, { date: k.expires_at.slice(0, 10) })}</span>}
                    </div>

                    {k.domains.length === 0 ? (
                      <p className="mt-2 text-[11px] text-ink-600">
                        {t.keys.eab.noDomain}
                      </p>
                    ) : (
                      <p className="mt-2 flex flex-wrap items-baseline gap-2 text-[11px]">
                        <span className="text-ink-600">{t.keys.eab.certsFor}</span>
                        {k.domains.map((d) => (
                          <span key={d.id} className="text-ink-300">
                            {d.name}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {modal === 'key' && (
        <Modal title={t.keys.keyModal.title} onClose={closeModal}>
          <form onSubmit={create} className="space-y-3">
            <Field label={t.keys.keyModal.name} hint={t.keys.keyModal.nameHint}>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t.keys.keyModal.expiration} hint={t.keys.keyModal.expirationHint}>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-xs text-ink-300">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="accent-[var(--color-warn)]"
              />
              {t.keys.keyModal.adminKey}
            </label>

            {!isAdmin && (
              <div className="border-t border-ink-800 pt-3">
                <GrantEditor domains={domains} draft={draft} toggle={toggle} applyPreset={applyPreset} />
              </div>
            )}

            <ErrorNote>{formError}</ErrorNote>
            <Button type="submit" variant="primary" disabled={!name} className="w-full">
              {t.keys.keyModal.submit}
            </Button>
          </form>
        </Modal>
      )}

      {modal === 'eab' && (
        <Modal title={t.keys.eabModal.title} onClose={closeModal}>
          <form onSubmit={createEab} className="space-y-3">
            <Field label={t.keys.eabModal.name} hint={t.keys.eabModal.nameHint}>
              <Input required autoFocus autoComplete="off" data-1p-ignore value={eabName} onChange={(e) => setEabName(e.target.value)} />
            </Field>
            <Field label={t.keys.eabModal.expiration} hint={t.keys.eabModal.expirationHint}>
              <Input type="date" value={eabExpiresAt} onChange={(e) => setEabExpiresAt(e.target.value)} />
            </Field>
            <div className="border-t border-ink-800 pt-3">
              <span className="mb-2 block text-[11px] text-ink-400">
                {t.keys.eabModal.allowedDomains}
              </span>
              {domains.length === 0 ? (
                <p className="text-[11px] text-ink-600">{t.keys.grants.declareDomain}</p>
              ) : (
                <div className="space-y-1.5">
                  {domains.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-xs text-ink-300">
                      <input
                        type="checkbox"
                        checked={eabDomains.has(d.id)}
                        onChange={() =>
                          setEabDomains((prev) => {
                            const next = new Set(prev);
                            if (next.has(d.id)) next.delete(d.id);
                            else next.add(d.id);
                            return next;
                          })
                        }
                        className="accent-[var(--color-accent)]"
                      />
                      <span className="text-ink-100">{d.name}</span>
                      <span className="text-ink-600">{t.keys.eabModal.andSubdomains}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <ErrorNote>{formError}</ErrorNote>
            <Button
              type="submit"
              variant="primary"
              disabled={!eabName || eabDomains.size === 0}
              className="w-full"
            >
              {t.keys.eabModal.submit}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function GrantEditor({
  domains,
  draft,
  toggle,
  applyPreset,
}: {
  domains: DomainRef[];
  draft: GrantDraft;
  toggle: (domainId: string, scope: string) => void;
  applyPreset: (domainId: string, scopes: string[]) => void;
}) {
  const t = useT();
  if (domains.length === 0) {
    return <p className="text-[11px] text-ink-600">{t.keys.grants.declareDomain}</p>;
  }
  return (
    <div className="space-y-3">
      {domains.map((d) => (
        <div key={d.id} className="rounded border border-ink-800 p-2.5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-100">{d.name}</span>
            <span className="ml-auto flex gap-1">
              {PRESETS.map(({ key, scopes }) => (
                <button
                  key={key}
                  type="button"
                  title={t.keys.presets[key].title}
                  onClick={() => applyPreset(d.id, [...scopes])}
                  className="rounded border border-ink-700 px-1.5 py-0.5 text-[11px] text-ink-400 hover:border-accent/50 hover:text-accent"
                >
                  {t.keys.presets[key].short}
                </button>
              ))}
            </span>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {DOMAIN_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-1.5 text-[11px] text-ink-300">
                <input
                  type="checkbox"
                  checked={draft[d.id]?.has(scope) ?? false}
                  onChange={() => toggle(d.id, scope)}
                  className="accent-[var(--color-accent)]"
                />
                <code className="text-ink-400">{scope}</code>
                <span className="text-ink-600">{t.keys.scopes[scope as keyof typeof t.keys.scopes] ?? scope}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


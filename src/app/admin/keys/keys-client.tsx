'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Copyable, ErrorNote, Field, Input, Panel, api } from '@/components/ui';
import { DOMAIN_SCOPES, SCOPE_LABELS } from '@/lib/scopes';

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

const PRESETS: Record<string, string[]> = {
  'Hôte (renouvelle son propre cert)': ['cert:read', 'cert:issue', 'cert:renew', 'cert:export'],
  'Lecture seule': ['cert:read', 'dns:read'],
  'Opérateur DNS': ['dns:read', 'dns:write'],
};

export function KeysClient({ keys, domains }: { keys: KeyView[]; domains: DomainRef[] }) {
  const router = useRouter();
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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
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
            Clé « {minted.name} » créée. Ce token n&apos;est affiché qu&apos;une fois.
          </p>
          <div className="mt-2 rounded border border-accent/30 bg-ink-950 px-3 py-2">
            <Copyable value={minted.token} />
          </div>
          <Button variant="ghost" className="mt-2" onClick={() => setMinted(null)}>
            j&apos;ai noté le token
          </Button>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Panel title="Clés d’API">
          {keys.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-400">Aucune clé.</p>
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
                    <code className="rounded border border-ink-700 px-1 text-[10px] text-ink-400">
                      {k.opaque ? `#${k.prefix}` : `lc_${k.prefix}_…`}
                    </code>
                    {k.is_own && (
                      <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                        mon compte
                      </span>
                    )}
                    {k.is_admin && (
                      <span className="rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-warn">
                        admin
                      </span>
                    )}
                    {k.revoked_at && (
                      <span className="rounded border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-danger">
                        révoquée
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
                          {editing === k.id ? 'fermer' : 'droits'}
                        </Button>
                      )}
                      <Button onClick={() => patch(k.id, { revoked: !k.revoked_at })}>
                        {k.revoked_at ? 'réactiver' : 'révoquer'}
                      </Button>
                      {!k.is_own && (
                        <Button variant="danger" onClick={() => destroy(k.id)}>
                          supprimer
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-4 text-[11px] text-ink-600">
                    <span>créée {k.created_at.slice(0, 10)}</span>
                    <span>
                      dernier usage {k.last_used_at ? k.last_used_at.slice(0, 16).replace('T', ' ') : 'jamais'}
                    </span>
                    {k.expires_at && <span>expire {k.expires_at.slice(0, 10)}</span>}
                  </div>

                  {k.is_admin ? (
                    <p className="mt-2 text-[11px] text-ink-400">
                      Accès total : tous domaines, tous scopes, console d&apos;administration.
                    </p>
                  ) : k.grants.length === 0 ? (
                    <p className="mt-2 text-[11px] text-ink-600">Aucun droit — la clé ne peut rien faire.</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {k.grants.map((g) => (
                        <li key={g.domain_id} className="flex flex-wrap items-baseline gap-2 text-[11px]">
                          <span className="text-ink-300">
                            {domains.find((d) => d.id === g.domain_id)?.name ?? '(domaine supprimé)'}
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
                        enregistrer les droits
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Nouvelle clé">
          <form onSubmit={create} className="space-y-3">
            <Field label="Nom" hint="ex. nas-salon, ci-deploy">
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Expiration" hint="vide = pas d’expiration">
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-xs text-ink-300">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="accent-[var(--color-warn)]"
              />
              Clé administrateur (accès console, tous droits)
            </label>

            {!isAdmin && (
              <div className="border-t border-ink-800 pt-3">
                <GrantEditor domains={domains} draft={draft} toggle={toggle} applyPreset={applyPreset} />
              </div>
            )}

            <Button type="submit" variant="primary" disabled={!name} className="w-full">
              Générer la clé
            </Button>
          </form>
        </Panel>
      </div>
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
  if (domains.length === 0) {
    return <p className="text-[11px] text-ink-600">Déclarez d&apos;abord un domaine.</p>;
  }
  return (
    <div className="space-y-3">
      {domains.map((d) => (
        <div key={d.id} className="rounded border border-ink-800 p-2.5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-100">{d.name}</span>
            <span className="ml-auto flex gap-1">
              {Object.entries(PRESETS).map(([label, scopes]) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  onClick={() => applyPreset(d.id, scopes)}
                  className="rounded border border-ink-700 px-1.5 py-0.5 text-[10px] text-ink-400 hover:border-accent/50 hover:text-accent"
                >
                  {label.split(' ')[0].toLowerCase()}
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
                <span className="text-ink-600">{SCOPE_LABELS[scope]}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


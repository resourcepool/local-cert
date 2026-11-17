import { db } from '@/lib/db';
import { parseScopes } from '@/lib/scopes';
import { requireAdminSession } from '@/lib/auth/guard';
import { listEabKeys } from '@/lib/acme-server/eab';
import { KeysClient } from './keys-client';

export const dynamic = 'force-dynamic';

export default async function KeysPage() {
  const session = await requireAdminSession();
  const [keys, grants, domains] = await Promise.all([
    db().selectFrom('api_keys').selectAll().orderBy('created_at', 'desc').execute(),
    db().selectFrom('grants').selectAll().execute(),
    db().selectFrom('domains').select(['id', 'name']).orderBy('name').execute(),
  ]);

  return (
    <KeysClient
      domains={domains}
      eabKeys={await listEabKeys()}
      keys={keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        opaque: k.opaque === 1,
        is_own: k.user_id !== null && k.user_id === session.keyId,
        is_admin: k.is_admin === 1,
        created_at: k.created_at,
        expires_at: k.expires_at,
        last_used_at: k.last_used_at,
        revoked_at: k.revoked_at,
        grants: grants
          .filter((g) => g.api_key_id === k.id)
          .map((g) => ({ domain_id: g.domain_id, scopes: parseScopes(g.scopes) as string[] })),
      }))}
    />
  );
}

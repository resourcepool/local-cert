import 'server-only';
import { randomBytes } from 'node:crypto';
import { db, nowIso } from '@/lib/db';
import { sha256Hex, safeEqualHex, randomId } from '@/lib/crypto/secrets';
import { parseScopes, type Scope } from '@/lib/scopes';

/**
 * Minted wire format: lc_<prefix8hex>_<secret base64url>
 *   prefix : indexed lookup handle, safe to display
 *   secret : 32 bytes of CSPRNG, stored as sha256
 *
 * An operator-supplied ADMIN_API_KEY may be any opaque string; its lookup
 * prefix is derived from its own sha256 so both kinds share one indexed path.
 *
 * sha256 (not argon2) is deliberate here: these tokens carry 256 bits of
 * machine entropy, so there is nothing to brute-force. Slow hashing is for
 * low-entropy human passwords — see crypto/password.ts.
 */

export const KEY_PREFIX = 'lc';

export interface MintedKey {
  id: string;
  prefix: string;
  /** shown exactly once */
  token: string;
  secretHash: string;
  opaque: boolean;
}

export function mintKey(): MintedKey {
  // hex, not base64url: the prefix must stay free of the "_" separator
  const prefix = randomBytes(4).toString('hex');
  const secret = randomBytes(32).toString('base64url');
  return {
    id: randomId('key'),
    prefix,
    token: `${KEY_PREFIX}_${prefix}_${secret}`,
    secretHash: sha256Hex(secret),
    opaque: false,
  };
}

/** Wraps a token the operator chose (ADMIN_API_KEY) into the same storage shape. */
export function adoptKey(token: string): MintedKey {
  const digest = sha256Hex(token);
  return {
    id: randomId('key'),
    prefix: digest.slice(0, 8),
    token,
    secretHash: digest,
    opaque: true,
  };
}

/** Resolves a presented token to the (prefix, hash) pair used for storage. */
function lookupOf(token: string): { prefix: string; secretHash: string } {
  const minted = /^lc_([0-9a-f]{8})_(.+)$/.exec(token);
  if (minted) return { prefix: minted[1], secretHash: sha256Hex(minted[2]) };
  const digest = sha256Hex(token);
  return { prefix: digest.slice(0, 8), secretHash: digest };
}

export interface ResolvedKey {
  id: string;
  name: string;
  userId: string | null;
  isAdmin: boolean;
  globalScopes: Scope[];
  /** domain_id -> scopes */
  grants: Record<string, Scope[]>;
}

export async function resolveApiKey(token: string): Promise<ResolvedKey | null> {
  const { prefix, secretHash } = lookupOf(token.trim());

  // Prefixes are only 32 bits, so a collision is possible in principle:
  // compare every candidate rather than trusting the first row.
  const candidates = await db()
    .selectFrom('api_keys')
    .selectAll()
    .where('prefix', '=', prefix)
    .execute();

  const row = candidates.find((c) => safeEqualHex(c.secret_hash, secretHash));
  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

  const grantRows = await db()
    .selectFrom('grants')
    .select(['domain_id', 'scopes'])
    .where('api_key_id', '=', row.id)
    .execute();

  const grants: Record<string, Scope[]> = {};
  for (const g of grantRows) grants[g.domain_id] = parseScopes(g.scopes);

  // fire-and-forget: last_used_at is telemetry, never block the request on it
  void db()
    .updateTable('api_keys')
    .set({ last_used_at: nowIso() })
    .where('id', '=', row.id)
    .execute()
    .catch(() => {});

  return {
    id: row.id,
    name: row.name,
    userId: row.user_id,
    isAdmin: row.is_admin === 1,
    globalScopes: parseScopes(row.global_scopes),
    grants,
  };
}

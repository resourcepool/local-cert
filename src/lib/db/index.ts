import 'server-only';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { Kysely, SqliteDialect, PostgresDialect, CamelCasePlugin } from 'kysely';
import type { Database } from './types';

export type DbDialect = 'sqlite' | 'postgres';

export const DIALECT: DbDialect = (() => {
  const raw = (process.env.DB_DIALECT ?? 'sqlite').toLowerCase();
  if (raw === 'sqlite' || raw === 'postgres' || raw === 'postgresql') {
    return raw === 'postgresql' ? 'postgres' : raw;
  }
  throw new Error(`DB_DIALECT must be "sqlite" or "postgres", got "${raw}"`);
})();

/**
 * The native drivers are loaded lazily so that picking one dialect never pulls
 * in the other's binary. A bare require() works under the Next bundler but
 * breaks the CLI scripts under plain Node ESM ("both require and top-level
 * await are present"), so go through createRequire, which works in both.
 */
const requireDriver = createRequire(import.meta.url);

let instance: Kysely<Database> | null = null;

function build(): Kysely<Database> {
  if (DIALECT === 'sqlite') {
    const SQLite = requireDriver('better-sqlite3');
    const file = process.env.SQLITE_PATH ?? './data/local-cert.db';
    // better-sqlite3 will not create the parent directory; a fresh clone would
    // otherwise fail at startup with "directory does not exist".
    mkdirSync(dirname(resolve(file)), { recursive: true });
    const db = new SQLite(file);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    return new Kysely<Database>({ dialect: new SqliteDialect({ database: db }) });
  }

  const { Pool } = requireDriver('pg');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required when DB_DIALECT=postgres');
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: url,
        max: Number(process.env.PG_POOL_MAX ?? 10),
        ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
      }),
    }),
  });
}

export function db(): Kysely<Database> {
  if (!instance) instance = build();
  return instance;
}

/** Dialect-portable "now" — everything is stored as ISO-8601 UTC text. */
export function nowIso(): string {
  return new Date().toISOString();
}

export function isoIn(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export type { Database };
export { CamelCasePlugin };

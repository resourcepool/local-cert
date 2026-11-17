import 'server-only';
import { sql, type Kysely } from 'kysely';
import { db, DIALECT, nowIso, type Database } from './index';

/**
 * Hand-rolled migrator: small enough to stay readable, and it lets each step
 * emit dialect-specific DDL without dragging in drizzle-kit/prisma codegen.
 */

type Step = { id: string; up: (k: Kysely<Database>) => Promise<void> };

const TEXT = 'text';
const INT = DIALECT === 'sqlite' ? 'integer' : 'integer';

const STEPS: Step[] = [
  {
    id: '001_init',
    up: async (k) => {
      await k.schema
        .createTable('settings')
        .addColumn('key', TEXT, (c) => c.primaryKey())
        .addColumn('value', TEXT, (c) => c.notNull())
        .addColumn('updated_at', TEXT, (c) => c.notNull())
        .execute();

      await k.schema
        .createTable('users')
        .addColumn('id', TEXT, (c) => c.primaryKey())
        .addColumn('email', TEXT, (c) => c.notNull().unique())
        .addColumn('password_hash', TEXT, (c) => c.notNull())
        .addColumn('is_admin', INT, (c) => c.notNull().defaultTo(1))
        .addColumn('created_at', TEXT, (c) => c.notNull())
        .addColumn('last_login_at', TEXT)
        .addColumn('disabled_at', TEXT)
        .execute();

      await k.schema
        .createTable('api_keys')
        .addColumn('id', TEXT, (c) => c.primaryKey())
        .addColumn('name', TEXT, (c) => c.notNull())
        .addColumn('user_id', TEXT, (c) => c.references('users.id').onDelete('cascade'))
        .addColumn('secret_hash', TEXT, (c) => c.notNull())
        .addColumn('prefix', TEXT, (c) => c.notNull())
        .addColumn('opaque', INT, (c) => c.notNull().defaultTo(0))
        .addColumn('is_admin', INT, (c) => c.notNull().defaultTo(0))
        .addColumn('global_scopes', TEXT, (c) => c.notNull().defaultTo('[]'))
        .addColumn('created_at', TEXT, (c) => c.notNull())
        .addColumn('expires_at', TEXT)
        .addColumn('last_used_at', TEXT)
        .addColumn('revoked_at', TEXT)
        .execute();
      await k.schema
        .createIndex('idx_api_keys_prefix')
        .on('api_keys')
        .column('prefix')
        .execute();

      await k.schema
        .createTable('domains')
        .addColumn('id', TEXT, (c) => c.primaryKey())
        .addColumn('name', TEXT, (c) => c.notNull().unique())
        .addColumn('route53_zone_id', TEXT, (c) => c.notNull())
        .addColumn('aws_role_arn', TEXT)
        .addColumn('aws_region', TEXT, (c) => c.notNull().defaultTo('us-east-1'))
        .addColumn('default_ttl', INT, (c) => c.notNull().defaultTo(60))
        .addColumn('created_at', TEXT, (c) => c.notNull())
        .execute();

      await k.schema
        .createTable('grants')
        .addColumn('id', TEXT, (c) => c.primaryKey())
        .addColumn('api_key_id', TEXT, (c) =>
          c.notNull().references('api_keys.id').onDelete('cascade'),
        )
        .addColumn('domain_id', TEXT, (c) =>
          c.notNull().references('domains.id').onDelete('cascade'),
        )
        .addColumn('scopes', TEXT, (c) => c.notNull().defaultTo('[]'))
        .addColumn('created_at', TEXT, (c) => c.notNull())
        .execute();
      await k.schema
        .createIndex('idx_grants_unique')
        .on('grants')
        .columns(['api_key_id', 'domain_id'])
        .unique()
        .execute();

      await k.schema
        .createTable('certificates')
        .addColumn('id', TEXT, (c) => c.primaryKey())
        .addColumn('domain_id', TEXT, (c) =>
          c.notNull().references('domains.id').onDelete('restrict'),
        )
        .addColumn('domains', TEXT, (c) => c.notNull())
        .addColumn('status', TEXT, (c) => c.notNull())
        .addColumn('key_type', TEXT, (c) => c.notNull().defaultTo('ec-256'))
        .addColumn('private_key_enc', TEXT)
        .addColumn('cert_pem', TEXT)
        .addColumn('chain_pem', TEXT)
        .addColumn('serial', TEXT)
        .addColumn('issuer', TEXT)
        .addColumn('not_before', TEXT)
        .addColumn('not_after', TEXT)
        .addColumn('fingerprint_sha256', TEXT)
        .addColumn('auto_renew', INT, (c) => c.notNull().defaultTo(1))
        .addColumn('renew_before_days', INT, (c) => c.notNull().defaultTo(30))
        .addColumn('dns_record', TEXT)
        .addColumn('webhook_url', TEXT)
        .addColumn('last_error', TEXT)
        .addColumn('locked_at', TEXT)
        .addColumn('attempt', INT, (c) => c.notNull().defaultTo(0))
        .addColumn('next_attempt_at', TEXT)
        .addColumn('idempotency_key', TEXT)
        .addColumn('created_by', TEXT, (c) => c.notNull())
        .addColumn('created_at', TEXT, (c) => c.notNull())
        .addColumn('updated_at', TEXT, (c) => c.notNull())
        .execute();
      await k.schema
        .createIndex('idx_cert_status')
        .on('certificates')
        .column('status')
        .execute();
      await k.schema
        .createIndex('idx_cert_idem')
        .on('certificates')
        .column('idempotency_key')
        .execute();

      await k.schema
        .createTable('certificate_events')
        .addColumn('id', TEXT, (c) => c.primaryKey())
        .addColumn('certificate_id', TEXT, (c) =>
          c.notNull().references('certificates.id').onDelete('cascade'),
        )
        .addColumn('at', TEXT, (c) => c.notNull())
        .addColumn('level', TEXT, (c) => c.notNull())
        .addColumn('step', TEXT, (c) => c.notNull())
        .addColumn('message', TEXT, (c) => c.notNull())
        .execute();
      await k.schema
        .createIndex('idx_events_cert')
        .on('certificate_events')
        .columns(['certificate_id', 'at'])
        .execute();

      await k.schema
        .createTable('audit_log')
        .addColumn('id', TEXT, (c) => c.primaryKey())
        .addColumn('at', TEXT, (c) => c.notNull())
        .addColumn('actor', TEXT, (c) => c.notNull())
        .addColumn('action', TEXT, (c) => c.notNull())
        .addColumn('target', TEXT)
        .addColumn('detail', TEXT)
        .addColumn('ip', TEXT)
        .execute();
    },
  },
  {
    id: '002_certificate_metadata',
    up: async (k) => {
      await k.schema
        .alterTable('certificates')
        .addColumn('metadata', TEXT, (c) => c.notNull().defaultTo('{}'))
        .execute();
    },
  },
  {
    id: '003_acme_server',
    up: async (k) => {
      // 'api' rows are driven by the worker; 'acme' rows by the ACME server,
      // which waits for a CSR the client only sends at finalization.
      await k.schema
        .alterTable('certificates')
        .addColumn('source', TEXT, (c) => c.notNull().defaultTo('api'))
        .execute();

      await k.schema
        .createTable('acme_eab_keys')
        .addColumn('id', TEXT, (c) => c.primaryKey())
        .addColumn('api_key_id', TEXT, (c) =>
          c.notNull().references('api_keys.id').onDelete('cascade'),
        )
        .addColumn('hmac_enc', TEXT, (c) => c.notNull())
        .addColumn('created_by', TEXT, (c) => c.notNull())
        .addColumn('created_at', TEXT, (c) => c.notNull())
        .addColumn('last_used_at', TEXT)
        .addColumn('revoked_at', TEXT)
        .execute();

      await k.schema
        .createTable('acme_accounts')
        .addColumn('id', TEXT, (c) => c.primaryKey())
        .addColumn('api_key_id', TEXT, (c) =>
          c.notNull().references('api_keys.id').onDelete('cascade'),
        )
        .addColumn('eab_id', TEXT, (c) => c.notNull())
        .addColumn('jwk', TEXT, (c) => c.notNull())
        .addColumn('thumbprint', TEXT, (c) => c.notNull().unique())
        .addColumn('contact', TEXT, (c) => c.notNull().defaultTo('[]'))
        .addColumn('status', TEXT, (c) => c.notNull())
        .addColumn('created_at', TEXT, (c) => c.notNull())
        .execute();

      await k.schema
        .createTable('acme_orders')
        .addColumn('id', TEXT, (c) => c.primaryKey())
        .addColumn('account_id', TEXT, (c) =>
          c.notNull().references('acme_accounts.id').onDelete('cascade'),
        )
        .addColumn('certificate_id', TEXT, (c) =>
          c.notNull().references('certificates.id').onDelete('cascade'),
        )
        .addColumn('identifiers', TEXT, (c) => c.notNull())
        .addColumn('status', TEXT, (c) => c.notNull())
        .addColumn('upstream_status', TEXT, (c) => c.notNull())
        .addColumn('upstream_order_url', TEXT)
        .addColumn('error', TEXT)
        .addColumn('expires_at', TEXT, (c) => c.notNull())
        .addColumn('created_at', TEXT, (c) => c.notNull())
        .execute();
      await k.schema
        .createIndex('idx_acme_orders_account')
        .on('acme_orders')
        .column('account_id')
        .execute();

      await k.schema
        .createTable('acme_authorizations')
        .addColumn('id', TEXT, (c) => c.primaryKey())
        .addColumn('order_id', TEXT, (c) =>
          c.notNull().references('acme_orders.id').onDelete('cascade'),
        )
        .addColumn('identifier', TEXT, (c) => c.notNull())
        .addColumn('wildcard', INT, (c) => c.notNull().defaultTo(0))
        .addColumn('token', TEXT, (c) => c.notNull())
        .addColumn('responded_type', TEXT)
        .addColumn('created_at', TEXT, (c) => c.notNull())
        .execute();
      await k.schema
        .createIndex('idx_acme_authz_order')
        .on('acme_authorizations')
        .column('order_id')
        .execute();

      await k.schema
        .createTable('acme_nonces')
        .addColumn('nonce', TEXT, (c) => c.primaryKey())
        .addColumn('expires_at', TEXT, (c) => c.notNull())
        .execute();
    },
  },
];

let migrated = false;

export async function migrate(): Promise<void> {
  if (migrated) return;
  const k = db();

  await k.schema
    .createTable('_migrations')
    .ifNotExists()
    .addColumn('id', TEXT, (c) => c.primaryKey())
    .addColumn('applied_at', TEXT, (c) => c.notNull())
    .execute();

  const applied = new Set(
    (
      await sql<{ id: string }>`select id from _migrations`.execute(k)
    ).rows.map((r) => r.id),
  );

  for (const step of STEPS) {
    if (applied.has(step.id)) continue;
    await step.up(k);
    await sql`insert into _migrations (id, applied_at) values (${step.id}, ${nowIso()})`.execute(k);
    console.log(`[migrate] applied ${step.id}`);
  }
  migrated = true;
}

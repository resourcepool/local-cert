import { db } from '@/lib/db';
import { handler, ok } from '@/lib/http';
import { requireAdminSession } from '@/lib/auth/guard';
import { accountStatus } from '@/lib/acme/client';
import { DIALECT } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireAdminSession();

  const byStatus = await db()
    .selectFrom('certificates')
    .select(['status', (eb) => eb.fn.countAll<number>().as('n')])
    .groupBy('status')
    .execute();

  const soon = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const expiring = await db()
    .selectFrom('certificates')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('status', '=', 'issued')
    .where('not_after', '<', soon)
    .executeTakeFirst();

  const [domains, keys, recent] = await Promise.all([
    db().selectFrom('domains').select((eb) => eb.fn.countAll<number>().as('n')).executeTakeFirst(),
    db()
      .selectFrom('api_keys')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('revoked_at', 'is', null)
      .executeTakeFirst(),
    db().selectFrom('audit_log').selectAll().orderBy('at', 'desc').limit(15).execute(),
  ]);

  let acme: unknown = { error: 'unavailable' };
  try {
    acme = await accountStatus();
  } catch (err) {
    acme = { error: (err as Error).message };
  }

  return ok({
    certificates: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])),
    expiring_30d: Number(expiring?.n ?? 0),
    domains: Number(domains?.n ?? 0),
    active_keys: Number(keys?.n ?? 0),
    dialect: DIALECT,
    acme,
    recent_audit: recent,
  });
});

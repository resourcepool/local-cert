import 'server-only';
import { sql } from 'kysely';
import { db, nowIso } from '@/lib/db';
import { runIssuance, logEvent, notify } from '@/lib/acme/issue';

/**
 * Single-process job runner. Orders are claimed with a conditional UPDATE on
 * locked_at, so a second replica would be safe-ish, but Route53 serialises
 * changes per zone anyway — run one instance. Scale out by moving this loop to
 * a dedicated worker process and pointing both at Postgres.
 */

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 10_000);
const LOCK_TIMEOUT_MS = 30 * 60_000;
const MAX_CONCURRENT = Number(process.env.WORKER_CONCURRENCY ?? 2);
const RENEW_SWEEP_MS = Number(process.env.RENEW_SWEEP_MS ?? 6 * 3600_000);

let started = false;
const inflight = new Set<string>();

export function startWorker(): void {
  if (started) return;
  started = true;
  console.log(`[worker] started (poll ${POLL_MS}ms, concurrency ${MAX_CONCURRENT})`);

  void loop(tick, POLL_MS);
  void loop(renewalSweep, RENEW_SWEEP_MS);
}

async function loop(fn: () => Promise<void>, intervalMs: number): Promise<void> {
  for (;;) {
    try {
      await fn();
    } catch (err) {
      console.error('[worker] loop error', err);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function tick(): Promise<void> {
  await releaseStaleLocks();
  if (inflight.size >= MAX_CONCURRENT) return;

  const candidates = await db()
    .selectFrom('certificates')
    .select(['id'])
    .where('locked_at', 'is', null)
    .where((eb) =>
      eb.or([
        eb('status', '=', 'pending'),
        eb.and([
          eb('status', '=', 'failed'),
          eb('next_attempt_at', 'is not', null),
          eb('next_attempt_at', '<=', nowIso()),
        ]),
      ]),
    )
    .orderBy('created_at', 'asc')
    .limit(MAX_CONCURRENT - inflight.size)
    .execute();

  for (const { id } of candidates) {
    if (inflight.has(id)) continue;
    const claimed = await db()
      .updateTable('certificates')
      .set({ locked_at: nowIso(), status: 'pending', updated_at: nowIso() })
      .where('id', '=', id)
      .where('locked_at', 'is', null)
      .executeTakeFirst();
    if (Number(claimed.numUpdatedRows ?? 0) === 0) continue;

    inflight.add(id);
    void runIssuance(id)
      .catch((err) => console.error(`[worker] issuance ${id} crashed`, err))
      .finally(() => inflight.delete(id));
  }
}

async function releaseStaleLocks(): Promise<void> {
  const cutoff = new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString();
  const stale = await db()
    .selectFrom('certificates')
    .select('id')
    .where('locked_at', 'is not', null)
    .where('locked_at', '<', cutoff)
    .execute();
  for (const { id } of stale) {
    if (inflight.has(id)) continue;
    await db()
      .updateTable('certificates')
      .set({ locked_at: null, status: 'failed', last_error: 'worker lock expired', updated_at: nowIso() })
      .where('id', '=', id)
      .execute();
    await logEvent(id, 'lock.expired', 'Reclaimed a stale order lock', 'warn');
  }
}

/**
 * Renew at not_after - renew_before_days, with a deterministic per-cert jitter
 * so a fleet of certs issued the same day does not stampede Let's Encrypt.
 */
async function renewalSweep(): Promise<void> {
  const now = Date.now();

  const due = await db()
    .selectFrom('certificates')
    .select(['id', 'not_after', 'renew_before_days'])
    .where('status', '=', 'issued')
    .where('auto_renew', '=', 1)
    .where('not_after', 'is not', null)
    .execute();

  for (const cert of due) {
    if (!cert.not_after) continue;
    const jitterHours = (hash(cert.id) % 48) - 24;
    const threshold =
      new Date(cert.not_after).getTime() -
      cert.renew_before_days * 86_400_000 +
      jitterHours * 3_600_000;
    if (now < threshold) continue;

    await db()
      .updateTable('certificates')
      .set({ status: 'pending', attempt: 0, next_attempt_at: null, updated_at: nowIso() })
      .where('id', '=', cert.id)
      .where('status', '=', 'issued')
      .execute();
    await logEvent(cert.id, 'renew.scheduled', 'Auto-renewal window reached');
  }

  const expired = await db()
    .updateTable('certificates')
    .set({ status: 'expired', updated_at: nowIso() })
    .where('status', '=', 'issued')
    .where('not_after', '<', nowIso())
    .executeTakeFirst();
  if (Number(expired.numUpdatedRows ?? 0) > 0) {
    console.log(`[worker] marked ${expired.numUpdatedRows} certificate(s) expired`);
  }

  void sql`select 1`.execute(db()).catch(() => {});
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export { notify };

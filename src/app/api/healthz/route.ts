import { sql } from 'kysely';
import { db, DIALECT } from '@/lib/db';
import { ok, problem } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await sql`select 1`.execute(db());
    return ok({ status: 'ok', dialect: DIALECT, at: new Date().toISOString() });
  } catch (err) {
    return problem('internal_error', 'Database unreachable', (err as Error).message);
  }
}

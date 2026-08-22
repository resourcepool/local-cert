/**
 * Next.js runs this once per server process, before any request is handled.
 * Migrations, the environment-driven admin account and the ACME worker live
 * here so they are not tied to a request lifecycle.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { ensureReady } = await import('@/lib/auth/setup');
  await ensureReady();

  if (process.env.DISABLE_WORKER === '1') {
    console.log('[worker] disabled via DISABLE_WORKER=1');
    return;
  }
  const { startWorker } = await import('@/lib/worker/runner');
  startWorker();
}

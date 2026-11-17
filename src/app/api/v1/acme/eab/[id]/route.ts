import { handler, ok } from '@/lib/http';
import { requireAuth, requireAdmin, audit } from '@/lib/auth/guard';
import { deleteEabKey, revokeEabKey } from '@/lib/acme-server/eab';

export const dynamic = 'force-dynamic';

/** DELETE /api/v1/acme/eab/{id}?purge=true — revokes the credential and its ACME accounts. */
export const DELETE = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const principal = await requireAuth(req);
  requireAdmin(principal);
  const { id } = await ctx.params;
  const purge = ['1', 'true'].includes(new URL(req.url).searchParams.get('purge') ?? '');

  const revoked = await revokeEabKey(id);
  if (purge) await deleteEabKey(id);
  await audit(principal.keyId, purge ? 'acme.eab.delete' : 'acme.eab.revoke', { target: id, req });
  return ok(revoked);
});

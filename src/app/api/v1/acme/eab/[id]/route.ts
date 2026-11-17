import { handler, ok } from '@/lib/http';
import { requireAuth, audit } from '@/lib/auth/guard';
import { revokeEabKey } from '@/lib/acme-server/eab';

export const dynamic = 'force-dynamic';

/** DELETE /api/v1/acme/eab/{id} — revokes the credential and its ACME accounts. */
export const DELETE = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const principal = await requireAuth(req);
  const { id } = await ctx.params;
  const revoked = await revokeEabKey(principal, id);
  await audit(principal.keyId, 'acme.eab.revoke', { target: id, req });
  return ok(revoked);
});

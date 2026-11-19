import 'server-only';
import { X509Certificate, createHmac } from 'node:crypto';
import { db, nowIso } from '@/lib/db';
import { randomId, encryptSecret } from '@/lib/crypto/secrets';
import type { CertificateStatus } from '@/lib/db/types';
import { acme, acmeClient } from './client';
import {
  upsertRecord,
  deleteRecord,
  waitForSync,
  waitForTxtPropagation,
  type ZoneConfig,
} from '@/lib/dns/zone';
import { zoneFor } from '@/lib/dns/providers';

export async function logEvent(
  certId: string,
  step: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info',
): Promise<void> {
  await db()
    .insertInto('certificate_events')
    .values({ id: randomId('ev'), certificate_id: certId, at: nowIso(), level, step, message })
    .execute();
}

async function setStatus(certId: string, status: CertificateStatus): Promise<void> {
  await db()
    .updateTable('certificates')
    .set({ status, updated_at: nowIso() })
    .where('id', '=', certId)
    .execute();
}

function keyPair(keyType: string) {
  switch (keyType) {
    case 'rsa-2048':
      return acme.crypto.createPrivateRsaKey(2048);
    case 'rsa-4096':
      return acme.crypto.createPrivateRsaKey(4096);
    case 'ec-384':
      return acme.crypto.createPrivateEcdsaKey('P-384');
    case 'ec-256':
    default:
      return acme.crypto.createPrivateEcdsaKey('P-256');
  }
}

/**
 * Runs one full DNS-01 issuance for an existing certificate row.
 * Every TXT record it creates is removed in the finally block, including on
 * failure — a leaked _acme-challenge record breaks the next attempt.
 */
export async function runIssuance(certId: string): Promise<void> {
  const cert = await db()
    .selectFrom('certificates')
    .selectAll()
    .where('id', '=', certId)
    .executeTakeFirstOrThrow();

  const domain = await db()
    .selectFrom('domains')
    .selectAll()
    .where('id', '=', cert.domain_id)
    .executeTakeFirstOrThrow();

  const zone: ZoneConfig = await zoneFor(domain);

  const names: string[] = JSON.parse(cert.domains);
  const created: Array<{ name: string; value: string }> = [];

  try {
    await setStatus(certId, 'pending');
    await logEvent(certId, 'order.create', `Requesting ${names.join(', ')}`);

    const client = await acmeClient();
    const [privateKey, csr] = await acme.crypto.createCsr(
      { commonName: names[0], altNames: names.slice(1) },
      await keyPair(cert.key_type),
    );

    const chain = await client.auto({
      csr,
      email: process.env.ACME_EMAIL,
      termsOfServiceAgreed: true,
      challengePriority: ['dns-01'],

      challengeCreateFn: async (_authz, challenge, keyAuthorization) => {
        if (challenge.type !== 'dns-01') throw new Error('only dns-01 is supported');
        const recordName = `_acme-challenge.${_authz.identifier.value}`;
        const value = keyAuthorization;
        await setStatus(certId, 'dns_propagating');
        await logEvent(certId, 'dns.upsert', `UPSERT TXT ${recordName}`);

        const changeId = await upsertRecord(zone, recordName, 'TXT', [value], 60);
        created.push({ name: recordName, value });

        await waitForSync(zone, changeId);
        await logEvent(certId, 'dns.insync', 'Route53 change is INSYNC');

        await waitForTxtPropagation(zone, recordName, value, 180_000, (m) =>
          void logEvent(certId, 'dns.propagation', m),
        );
        await logEvent(certId, 'dns.propagated', 'TXT visible on all authoritative NS');
        await setStatus(certId, 'validating');
      },

      challengeRemoveFn: async (_authz, _challenge, keyAuthorization) => {
        const recordName = `_acme-challenge.${_authz.identifier.value}`;
        await deleteRecord(zone, recordName, 'TXT', [keyAuthorization], 60);
        const idx = created.findIndex((c) => c.name === recordName);
        if (idx >= 0) created.splice(idx, 1);
        await logEvent(certId, 'dns.cleanup', `DELETE TXT ${recordName}`);
      },
    });

    await storeIssued(certId, chain, privateKey.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const attempt = cert.attempt + 1;
    const backoffMs = Math.min(2 ** attempt * 60_000, 6 * 3600_000);
    const giveUp = attempt >= 5;

    await db()
      .updateTable('certificates')
      .set({
        status: 'failed',
        last_error: message,
        attempt,
        next_attempt_at: giveUp ? null : new Date(Date.now() + backoffMs).toISOString(),
        updated_at: nowIso(),
      })
      .where('id', '=', certId)
      .execute();

    await logEvent(
      certId,
      'failed',
      giveUp ? `${message} (giving up after ${attempt} attempts)` : `${message} (retry in ${Math.round(backoffMs / 60000)} min)`,
      'error',
    );
    await notify(certId, 'certificate.failed');
  } finally {
    // Belt and braces: acme-client skips challengeRemoveFn on some failure paths.
    for (const rec of created) {
      await deleteRecord(zone, rec.name, 'TXT', [rec.value], 60).catch(() => {});
    }
    await db()
      .updateTable('certificates')
      .set({ locked_at: null })
      .where('id', '=', certId)
      .execute();
  }
}

/** Records a freshly issued chain. `privateKey` is null when the client kept its own key. */
async function storeIssued(certId: string, chain: string, privateKey: string | null): Promise<void> {
  const x509 = new X509Certificate(chain);
  const leafEnd = chain.indexOf('-----END CERTIFICATE-----') + '-----END CERTIFICATE-----'.length;
  const leafPem = chain.slice(0, leafEnd) + '\n';
  const chainPem = chain.slice(leafEnd).trim() + '\n';

  await db()
    .updateTable('certificates')
    .set({
      status: 'issued',
      private_key_enc: privateKey === null ? null : encryptSecret(privateKey),
      cert_pem: leafPem,
      chain_pem: chainPem,
      serial: x509.serialNumber,
      issuer: x509.issuer.split('\n').find((l) => l.startsWith('CN='))?.slice(3) ?? x509.issuer,
      not_before: new Date(x509.validFrom).toISOString(),
      not_after: new Date(x509.validTo).toISOString(),
      fingerprint_sha256: x509.fingerprint256,
      last_error: null,
      attempt: 0,
      next_attempt_at: null,
      updated_at: nowIso(),
    })
    .where('id', '=', certId)
    .execute();

  await logEvent(certId, 'issued', `Valid until ${new Date(x509.validTo).toISOString()}`);
  await notify(certId, 'certificate.issued');
}

async function failExternal(certId: string, err: unknown): Promise<string> {
  const message = err instanceof Error ? err.message : String(err);
  // No retry: the ACME client owns the retry loop and will open a new order.
  await db()
    .updateTable('certificates')
    .set({
      status: 'failed',
      last_error: message,
      next_attempt_at: null,
      locked_at: null,
      updated_at: nowIso(),
    })
    .where('id', '=', certId)
    .execute();
  await logEvent(certId, 'failed', message, 'error');
  await notify(certId, 'certificate.failed');
  return message;
}

/**
 * First half of an issuance whose key lives on the client (ACME server
 * orders): opens the order at the upstream CA and proves control of every
 * name over DNS-01, but stops before finalization because the CSR is not
 * known yet. Returns the upstream order URL to finalize later.
 */
export async function validateExternalOrder(certId: string): Promise<string> {
  const cert = await db()
    .selectFrom('certificates')
    .selectAll()
    .where('id', '=', certId)
    .executeTakeFirstOrThrow();
  const domain = await db()
    .selectFrom('domains')
    .selectAll()
    .where('id', '=', cert.domain_id)
    .executeTakeFirstOrThrow();
  const zone: ZoneConfig = await zoneFor(domain);
  const names: string[] = JSON.parse(cert.domains);

  try {
    await logEvent(certId, 'order.create', `Requesting ${names.join(', ')} (ACME client order)`);
    const client = await acmeClient();
    const order = await client.createOrder({
      identifiers: names.map((value) => ({ type: 'dns', value })),
    });
    const authzs = await client.getAuthorizations(order);

    // "example.com" and "*.example.com" share one TXT name: those must go one
    // after the other, since each UPSERT replaces the record's value.
    const byRecord = new Map<string, typeof authzs>();
    for (const authz of authzs) {
      if (authz.status === 'valid') continue;
      const recordName = `_acme-challenge.${authz.identifier.value}`;
      byRecord.set(recordName, [...(byRecord.get(recordName) ?? []), authz]);
    }

    if (byRecord.size > 0) await setStatus(certId, 'dns_propagating');

    await Promise.all(
      [...byRecord].map(async ([recordName, group]) => {
        for (const authz of group) {
          const challenge = authz.challenges.find((c) => c.type === 'dns-01');
          if (!challenge) throw new Error(`upstream CA offers no dns-01 for ${authz.identifier.value}`);
          const value = await client.getChallengeKeyAuthorization(challenge);

          await logEvent(certId, 'dns.upsert', `UPSERT TXT ${recordName}`);
          const changeId = await upsertRecord(zone, recordName, 'TXT', [value], 60);
          try {
            await waitForSync(zone, changeId);
            await waitForTxtPropagation(zone, recordName, value, 180_000, (m) =>
              void logEvent(certId, 'dns.propagation', m),
            );
            await logEvent(certId, 'dns.propagated', `TXT ${recordName} visible on all authoritative NS`);
            await client.completeChallenge(challenge);
            await client.waitForValidStatus(challenge);
          } finally {
            await deleteRecord(zone, recordName, 'TXT', [value], 60).catch(() => {});
            await logEvent(certId, 'dns.cleanup', `DELETE TXT ${recordName}`);
          }
        }
      }),
    );

    await db()
      .updateTable('certificates')
      .set({ status: 'validating', locked_at: null, updated_at: nowIso() })
      .where('id', '=', certId)
      .execute();
    await logEvent(certId, 'acme.ready', 'Names validated upstream, waiting for the client CSR');
    return order.url;
  } catch (err) {
    throw new Error(await failExternal(certId, err));
  }
}

/** Second half: finalizes the upstream order with the CSR the ACME client sent. */
export async function finalizeExternalOrder(
  certId: string,
  upstreamOrderUrl: string,
  csrPem: string,
): Promise<void> {
  try {
    await logEvent(certId, 'order.finalize', 'Finalizing with the client CSR');
    const client = await acmeClient();
    const order = await client.getOrder({ url: upstreamOrderUrl } as acme.Order);
    const finalized = await client.finalizeOrder(order, csrPem);
    const chain = await client.getCertificate(finalized);
    await storeIssued(certId, chain, null);
  } catch (err) {
    throw new Error(await failExternal(certId, err));
  }
}

/** Signed webhook so the client can verify it really came from us. */
export async function notify(certId: string, event: string): Promise<void> {
  const cert = await db()
    .selectFrom('certificates')
    .select(['webhook_url', 'domains', 'status', 'not_after'])
    .where('id', '=', certId)
    .executeTakeFirst();
  if (!cert?.webhook_url) return;

  const body = JSON.stringify({
    event,
    id: certId,
    domains: JSON.parse(cert.domains),
    status: cert.status,
    not_after: cert.not_after,
    bundle_url: `/api/v1/certificates/${certId}/bundle`,
    at: nowIso(),
  });

  const secret = process.env.WEBHOOK_SECRET;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (secret) {
    headers['x-signature'] = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  try {
    await fetch(cert.webhook_url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    await logEvent(certId, 'webhook', `Delivery failed: ${(err as Error).message}`, 'warn');
  }
}

/** Revokes at the CA, then wipes key material locally. */
export async function revoke(certId: string, reason = 0): Promise<void> {
  const cert = await db()
    .selectFrom('certificates')
    .select(['cert_pem'])
    .where('id', '=', certId)
    .executeTakeFirst();

  if (cert?.cert_pem) {
    try {
      const client = await acmeClient();
      await client.revokeCertificate(cert.cert_pem, { reason });
      await logEvent(certId, 'revoked', 'Revoked at the CA');
    } catch (err) {
      await logEvent(certId, 'revoked', `CA revocation failed: ${(err as Error).message}`, 'warn');
    }
  }

  await db()
    .updateTable('certificates')
    .set({
      status: 'revoked',
      private_key_enc: null,
      auto_renew: 0,
      updated_at: nowIso(),
    })
    .where('id', '=', certId)
    .execute();
}

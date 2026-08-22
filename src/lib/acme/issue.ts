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
} from '@/lib/dns/route53';

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

  const zone: ZoneConfig = {
    zoneId: domain.route53_zone_id,
    region: domain.aws_region,
    roleArn: domain.aws_role_arn,
  };

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

    const x509 = new X509Certificate(chain);
    const leafEnd = chain.indexOf('-----END CERTIFICATE-----') + '-----END CERTIFICATE-----'.length;
    const leafPem = chain.slice(0, leafEnd) + '\n';
    const chainPem = chain.slice(leafEnd).trim() + '\n';

    await db()
      .updateTable('certificates')
      .set({
        status: 'issued',
        private_key_enc: encryptSecret(privateKey.toString()),
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

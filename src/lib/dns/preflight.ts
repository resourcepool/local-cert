import 'server-only';
import {
  ChangeResourceRecordSetsCommand,
  GetChangeCommand,
  GetHostedZoneCommand,
  ListResourceRecordSetsCommand,
  type RRType,
} from '@aws-sdk/client-route-53';
import { clientFor, type ZoneConfig } from './route53';

/**
 * Checks every Route53 call local-cert makes, before a domain is registered.
 *
 * Write access is probed with a DELETE of a record that cannot exist. Route53
 * evaluates IAM before validating the ChangeBatch, so an authorized principal
 * gets InvalidChangeBatch ("not found") and an unauthorized one gets
 * AccessDenied. Either way the zone is never modified: a DELETE of an absent
 * RRset is rejected atomically.
 *
 * Probing beats reading the policy — the IAM document is usually unreadable
 * from a scoped key, and a condition that silently fails to match produces the
 * exact same "no identity-based policy allows" message as a missing statement.
 */

export interface PreflightCheck {
  id: string;
  label: string;
  required: boolean;
  ok: boolean;
  note: string;
  /** why local-cert needs it, shown when the check fails */
  why?: string;
}

export interface PreflightResult {
  /** zone apex, discovered from the listing (GetHostedZone may be denied) */
  zoneName: string | null;
  checks: PreflightCheck[];
  failures: PreflightCheck[];
  ok: boolean;
}

const WHY: Record<string, string> = {
  list_records: 'Registering a domain and listing its records.',
  get_hosted_zone:
    'Reading the delegation set to poll the authoritative nameservers during DNS-01.',
  get_change: 'Waiting for INSYNC after each write.',
  change_txt: 'DNS-01 is built on TXT records — nothing can be issued without it.',
  change_a: 'Only needed if local-cert should publish the host A record for you.',
};

function classify(err: unknown): { ok: boolean; note: string } {
  const name = (err as { name?: string })?.name ?? '';
  const msg = err instanceof Error ? err.message : String(err);
  if (/InvalidChangeBatch/i.test(name) || /but it was not found/i.test(msg)) {
    return { ok: true, note: 'authorized' };
  }
  if (/AccessDenied/i.test(name) || /not authorized/i.test(msg)) {
    return { ok: false, note: 'AccessDenied' };
  }
  return { ok: false, note: `${name || 'error'}: ${msg.slice(0, 160)}` };
}

export async function preflightZone(zone: ZoneConfig): Promise<PreflightResult> {
  const client = clientFor(zone);
  const checks: PreflightCheck[] = [];
  const probeLabel = `_localcert-preflight-${Date.now().toString(36)}`;
  let zoneName: string | null = null;

  const read = async (id: string, label: string, required: boolean, fn: () => Promise<void>) => {
    try {
      await fn();
      checks.push({ id, label, required, ok: true, note: 'authorized' });
    } catch (err) {
      checks.push({ id, label, required, ...classify(err), why: WHY[id] });
    }
  };

  await read('list_records', 'ListResourceRecordSets', true, async () => {
    const res = await client.send(
      new ListResourceRecordSetsCommand({ HostedZoneId: zone.zoneId, MaxItems: 1 }),
    );
    zoneName = (res.ResourceRecordSets?.[0]?.Name ?? '').replace(/\.$/, '') || null;
  });

  await read('get_hosted_zone', 'GetHostedZone', true, async () => {
    await client.send(new GetHostedZoneCommand({ Id: zone.zoneId }));
  });

  await read('get_change', 'GetChange', true, async () => {
    try {
      await client.send(new GetChangeCommand({ Id: '/change/C0000000000000000000000' }));
    } catch (err) {
      // A bogus id is expected to 404; only an authorization failure matters.
      if ((err as { name?: string }).name === 'NoSuchChange') return;
      throw err;
    }
  });

  // Without a resolvable apex the probe name would fall outside the zone and
  // Route53 would reject it for the wrong reason.
  const apex = zoneName;
  const probeWrite = async (id: string, type: RRType, value: string, required: boolean) => {
    if (!apex) {
      checks.push({
        id,
        label: `ChangeResourceRecordSets (${type})`,
        required,
        ok: false,
        note: 'skipped — zone apex unknown because ListResourceRecordSets is denied',
        why: WHY[id],
      });
      return;
    }
    await read(id, `ChangeResourceRecordSets (${type})`, required, async () => {
      await client.send(
        new ChangeResourceRecordSetsCommand({
          HostedZoneId: zone.zoneId,
          ChangeBatch: {
            Comment: 'local-cert preflight probe',
            Changes: [
              {
                Action: 'DELETE',
                ResourceRecordSet: {
                  Name: `${probeLabel}.${apex}.`,
                  Type: type,
                  TTL: 60,
                  ResourceRecords: [{ Value: value }],
                },
              },
            ],
          },
        }),
      );
    });
  };

  await probeWrite('change_txt', 'TXT', '"local-cert-preflight"', true);
  await probeWrite('change_a', 'A', '192.0.2.1', false);

  const failures = checks.filter((c) => c.required && !c.ok);
  return { zoneName, checks, failures, ok: failures.length === 0 };
}

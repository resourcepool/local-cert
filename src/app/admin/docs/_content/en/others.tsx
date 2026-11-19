import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function Others({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Other systems</h1>
      <p className="lead">
        Two recipes cover everything that has no guide of its own: a generic ACME client when the
        system accepts one, and local-cert&apos;s API when it can only import a certificate.
      </p>

      <h2>Recognizing the right case</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>The system…</th>
              <th>Recipe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>has an ACME client with a custom CA URL, EAB and HTTP-01</td>
              <td>
                configure it with the three values of the EAB credential, as in{' '}
                <Link href="/admin/docs/acme">ACME server</Link>
              </td>
            </tr>
            <tr>
              <td>gives shell access</td>
              <td>
                acme.sh and a deploy hook — see{' '}
                <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>
              </td>
            </tr>
            <tr>
              <td>can only import a certificate, or only does DNS-01</td>
              <td>local-cert&apos;s API, below</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Pointers by system</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>System</th>
              <th>Approach</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>OPNsense</td>
              <td>
                <code>os-acme-client</code> plugin: create an account on a custom CA with the
                directory URL and the EAB fields, then a certificate using the HTTP-01 challenge.
                The plugin is built on acme.sh.
              </td>
            </tr>
            <tr>
              <td>pfSense</td>
              <td>
                ACME package: if your version offers a custom ACME server with EAB, follow the same
                approach. Otherwise, run acme.sh from a shell and import the result in{' '}
                <b>System</b> → <b>Certificates</b>.
              </td>
            </tr>
            <tr>
              <td>TrueNAS</td>
              <td>
                Its ACME client only does DNS-01 with its own providers: use local-cert&apos;s API,
                then import the certificate.
              </td>
            </tr>
            <tr>
              <td>Unraid, UniFi, printers, iDRAC/iLO, network equipment</td>
              <td>Certificate import: local-cert&apos;s API.</td>
            </tr>
            <tr>
              <td>Zoraxy, SWAG, proxies based on lego or certbot</td>
              <td>
                If they expose the CA URL and EAB, generic case. Otherwise, import.
              </td>
            </tr>
            <tr>
              <td>Envoy, proxies without an ACME client</td>
              <td>
                acme.sh or lego alongside, files mounted into the proxy, reload in a hook.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout title="Before trying a built-in ACME client">
        Check the three prerequisites: a free directory URL, External Account Binding, the HTTP-01
        challenge. If one is missing, go straight to the API: you&apos;ll save time.
      </Callout>

      <h2>API recipe: local-cert keeps the key and renews</h2>
      <p>
        Here the target system doesn&apos;t talk to local-cert. local-cert generates the key,
        obtains the certificate and renews it, and a script fetches the current version. You need
        an <b>API key</b> (<Link href="/admin/keys">Keys &amp; access</Link>) with the{' '}
        <code>cert:issue</code>, <code>cert:read</code> and <code>cert:export</code> permissions on
        the domain.
      </p>
      <h3>1. Request the certificate, once</h3>
      <CodeBlock
        title="curl"
        code={`curl -X POST ${ctx.origin}/api/v1/certificates \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H 'content-type: application/json' \\
  -d '{"domains": ["${EX.host}"], "key_type": "ec-256", "auto_renew": true}'
# → { "id": "cert_…", "status": "pending", … }`}
      />
      <h3>2. Fetch certificate and key, on every run</h3>
      <CodeBlock
        title="scheduled script (cron, daily)"
        code={`#!/bin/sh
set -eu
ID=cert_XXXXXXXXXXXXXXXX
OUT=/etc/ssl/local-cert

curl -fsS -H "Authorization: Bearer $TOKEN" \\
  "${ctx.origin}/api/v1/certificates/$ID/bundle?format=pem&include=fullchain" \\
  -o "$OUT/fullchain.pem.new"
curl -fsS -H "Authorization: Bearer $TOKEN" \\
  "${ctx.origin}/api/v1/certificates/$ID/bundle?format=pem&include=key" \\
  -o "$OUT/privkey.pem.new"

# only reload if the certificate changed
if ! cmp -s "$OUT/fullchain.pem.new" "$OUT/fullchain.pem"; then
  mv "$OUT/fullchain.pem.new" "$OUT/fullchain.pem"
  mv "$OUT/privkey.pem.new"  "$OUT/privkey.pem"
  # here: the target system's import or reload command
fi`}
      />
      <p>
        Instead of polling every day, the request accepts a <code>webhook_url</code> that is called
        on every issuance and renewal. The routes are detailed in <Link href="/admin/api">API</Link>.
      </p>
    </>
  );
}

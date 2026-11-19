import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EabValues, type DocCtx } from '../../_lib/prose';

export default function Acme({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>ACME server</h1>
      <p className="lead">
        local-cert exposes an ACME endpoint (RFC 8555) at <code>/acme/directory</code>. Any tool
        that can request a certificate from Let&apos;s Encrypt can request it from local-cert
        instead, for hosts that Let&apos;s Encrypt could never reach.
      </p>
      <CodeBlock title="This instance's directory" code={ctx.directory} />

      <h2>What it is, and what it isn&apos;t</h2>
      <p>
        It is not a certificate authority. local-cert signs nothing: it acts as an intermediary
        between your ACME client and Let&apos;s Encrypt, and the certificate you receive is a real
        Let&apos;s Encrypt certificate, trusted everywhere.
      </p>
      <p>
        The problem it solves: a regular ACME client proves it controls a name by answering on port
        80 (HTTP-01), which requires Let&apos;s Encrypt to be able to reach the machine. On a LAN
        that is impossible. Proving control through DNS (DNS-01) works, but means handing DNS
        credentials to every machine. local-cert keeps those credentials to itself and does the DNS
        proof on the client&apos;s behalf.
      </p>

      <h2>How a certificate is issued</h2>
      <ol>
        <li>
          <b>Registration.</b> The client creates its ACME account by presenting an EAB credential.
          This happens once; after that it signs with its own account key.
        </li>
        <li>
          <b>Order.</b> The client requests a certificate for one or more names. local-cert checks
          that they belong to a managed domain, and that the EAB credential is allowed on it.
          Otherwise the order is rejected immediately.
        </li>
        <li>
          <b>Challenge.</b> local-cert offers an HTTP-01 challenge, like an ordinary CA. The client
          prepares its response and signals that it is ready.
        </li>
        <li>
          <b>Actual validation.</b> local-cert never fetches the HTTP response. Instead, it opens
          an order with Let&apos;s Encrypt, writes the <code>_acme-challenge</code> TXT record in
          your zone, waits for it to propagate, has it validated, then deletes the record. The
          client&apos;s challenge turns <code>valid</code> when this is done.
        </li>
        <li>
          <b>Finalization.</b> The client sends its CSR. local-cert forwards it to Let&apos;s
          Encrypt and returns the certificate chain. The private key never left the client.
        </li>
      </ol>
      <Callout title="Practical consequences">
        <ul>
          <li>
            The client&apos;s port 80 doesn&apos;t need to be reachable, neither by local-cert nor
            by the Internet. The client only needs to be able to call local-cert over HTTP(S).
          </li>
          <li>
            Step 4 takes one to three minutes: that is the DNS propagation time. Clients wait on
            their own; don&apos;t lower their timeouts.
          </li>
          <li>
            Only HTTP-01 is offered. A client configured for DNS-01 or TLS-ALPN-01 only will not
            find a compatible challenge.
          </li>
        </ul>
      </Callout>

      <h2>EAB credentials</h2>
      <p>
        EAB stands for <i>External Account Binding</i>. It is the mechanism ACME provides so that a
        CA only accepts clients it already knows: when creating its account, the client proves it
        holds a secret handed to it in advance. Here, it replaces the API key.
      </p>
      <p>An EAB credential consists of two values, plus the server URL:</p>
      <EabValues ctx={ctx} />
      <p>
        It is created in <Link href="/admin/keys">Keys &amp; access</Link> →{' '}
        <b>EAB credentials</b> → <b>+ New credential</b>, with:
      </p>
      <ul>
        <li>
          a <b>name</b>, so you know which client it was handed to;
        </li>
        <li>
          an optional <b>expiry</b>;
        </li>
        <li>
          the <b>allowed domains</b>: the client can only request certificates under those.
        </li>
      </ul>
      <h3>Good to know</h3>
      <ul>
        <li>
          The HMAC key is displayed only once. If you lose it, you must create a new credential.
        </li>
        <li>
          The client only uses it at registration, but local-cert re-reads the credential on every
          request: <b>revoking</b> it or letting it <b>expire</b> also cuts off clients that are
          already registered.
        </li>
        <li>
          One credential can serve several clients. One credential per client lets you cut them off
          separately and see who issued what.
        </li>
        <li>
          The key is base64url-encoded, the format all clients expect (
          <code>hmacEncoded</code>, <code>--eab-hmac-key</code>, <code>mac_key</code>…).
        </li>
      </ul>

      <h2>What the client must be able to do</h2>
      <p>Three things, which nearly all modern ACME clients support:</p>
      <ol>
        <li>use a custom directory URL;</li>
        <li>register with an External Account Binding;</li>
        <li>solve an HTTP-01 challenge.</li>
      </ol>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Support</th>
              <th>Guide</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Traefik', 'native', 'acme/traefik'],
              ['Caddy', 'native', 'acme/caddy'],
              ['Apache httpd', 'native (mod_md)', 'acme/apache'],
              ['Nginx', 'via certbot or acme.sh', 'acme/nginx'],
              ['HAProxy', 'via acme.sh', 'acme/haproxy'],
              ['Nginx Proxy Manager', 'manual import', 'acme/nginx-proxy-manager'],
              ['Kubernetes', 'native (cert-manager)', 'acme/kubernetes'],
              ['Dokploy', 'native (Traefik)', 'acme/dokploy'],
              ['Coolify', 'native (Traefik)', 'acme/coolify'],
              ['Synology DSM', 'via acme.sh', 'acme/synology'],
              ['Proxmox VE', 'native (pvenode)', 'acme/proxmox'],
              ['certbot, acme.sh, lego', 'native', 'acme/clients'],
            ].map(([tool, support, slug]) => (
              <tr key={slug}>
                <td>{tool}</td>
                <td>{support}</td>
                <td>
                  <Link href={`/admin/docs/${slug}`}>open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        For everything else, see <Link href="/admin/docs/acme/others">Other systems</Link>.
      </p>

      <h2>Rules and limits</h2>
      <ul>
        <li>
          A name outside the managed domains is rejected (<code>rejectedIdentifier</code>); so is a
          domain the credential isn&apos;t authorized for (<code>unauthorized</code>).
        </li>
        <li>All names in a single order must belong to the same managed domain.</li>
        <li>
          Wildcards (<code>*.home.example.com</code>) are accepted: since the actual validation is
          done with DNS-01, the usual HTTP-01 restriction doesn&apos;t apply. Some clients
          nevertheless refuse a wildcard over HTTP-01 on their own.
        </li>
        <li>
          These certificates show up in <Link href="/admin/certificates">Certificates</Link> with
          the <code>external</code> key type, with no private key and no automatic renewal: the
          client does the renewing.
        </li>
        <li>
          An ACME account can revoke the certificates it obtained. Account key rollover (
          <code>keyChange</code>) is not implemented.
        </li>
      </ul>

      <h2>Troubleshooting</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symptom</th>
              <th>Cause</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>JWS &quot;url&quot; is … but this endpoint is …</code>
              </td>
              <td>
                local-cert is behind a proxy that doesn&apos;t forward{' '}
                <code>X-Forwarded-Proto</code> / <code>X-Forwarded-Host</code>. Forward them, or set
                the <code>PUBLIC_URL</code> variable.
              </td>
            </tr>
            <tr>
              <td>
                <code>externalAccountRequired</code>
              </td>
              <td>The client is registering without EAB. Check its configuration.</td>
            </tr>
            <tr>
              <td>
                <code>unauthorized</code> at registration
              </td>
              <td>Unknown, revoked or expired credential, or wrong HMAC key.</td>
            </tr>
            <tr>
              <td>
                <code>rejectedIdentifier</code>
              </td>
              <td>The requested name is not under any managed domain.</td>
            </tr>
            <tr>
              <td>The client gives up after ~1 minute</td>
              <td>
                Its timeout is shorter than the DNS validation. Run it again: the order in progress
                is resumed.
              </td>
            </tr>
            <tr>
              <td>TLS error when connecting to local-cert</td>
              <td>
                local-cert is served with a certificate the client doesn&apos;t trust. Serve it with
                a public certificate, or add its CA to the client&apos;s trust store.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

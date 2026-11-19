import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function NginxProxyManager({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Nginx Proxy Manager</h1>
      <p className="lead">
        Nginx Proxy Manager&apos;s interface lets you choose neither the ACME server nor an EAB:
        its built-in issuance only talks to Let&apos;s Encrypt. The certificate is therefore
        obtained separately, then imported as a custom certificate.
      </p>

      <h2>1. Get the certificate</h2>
      <p>
        On the host, with acme.sh (see{' '}
        <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link> for details):
      </p>
      <CodeBlock
        title="acme.sh"
        code={`acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid eab_XXXXXXXXXXXXXXXX --eab-hmac-key CLE_HMAC -m ops@example.com

mkdir -p /var/lib/acme-webroot /opt/npm-certs
acme.sh --issue --server ${ctx.directory} -d ${EX.host} -w /var/lib/acme-webroot
acme.sh --install-cert -d ${EX.host} \\
  --key-file       /opt/npm-certs/${EX.host}.key \\
  --fullchain-file /opt/npm-certs/${EX.host}.pem`}
      />

      <h2>2. Import it</h2>
      <ol>
        <li>
          <b>SSL Certificates</b> → <b>Add SSL Certificate</b> → <b>Custom</b>.
        </li>
        <li>
          Key: <code>{EX.host}.key</code>. Certificate: <code>{EX.host}.pem</code>.
        </li>
        <li>
          In the <b>Proxy Host</b>, <b>SSL</b> tab, select this certificate.
        </li>
      </ol>

      <Callout kind="warn" title="Renewal is not automatic">
        acme.sh renews the files, but Nginx Proxy Manager keeps the imported copy. Roughly every
        two months, import the certificate again — or, if you have the choice, prefer a proxy that
        speaks ACME with a custom CA (Traefik, Caddy), where everything is automatic.
      </Callout>

      <h2>Another route: let local-cert manage the key</h2>
      <p>
        Through the <Link href="/admin/api">API</Link>, local-cert generates the key, renews on its
        own and exposes the current certificate. A scheduled script then only has to download the
        bundle and push it into Nginx Proxy Manager. See{' '}
        <Link href="/admin/docs/acme/others">Other systems</Link>.
      </p>
    </>
  );
}

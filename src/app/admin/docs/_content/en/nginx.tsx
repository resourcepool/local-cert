import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Nginx({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Nginx</h1>
      <p className="lead">
        In most setups Nginx doesn&apos;t request certificates itself: an ACME client runs
        alongside it, writes the files and reloads Nginx. certbot is the usual choice.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Get the certificate</h2>
      <p>
        Nginx holds port 80: use webroot mode with an empty folder. It doesn&apos;t need to be
        served by Nginx, since local-cert never reads from it.
      </p>
      <CodeBlock
        title="certbot"
        code={`mkdir -p /var/lib/letsencrypt/webroot
certbot certonly --webroot -w /var/lib/letsencrypt/webroot -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} \\
  --email ${EX.email} --agree-tos --no-eff-email \\
  --deploy-hook "systemctl reload nginx"`}
      />

      <h2>2. Wire Nginx to it</h2>
      <CodeBlock
        title={`/etc/nginx/conf.d/${EX.host}.conf`}
        code={`server {
    listen 443 ssl;
    http2 on;
    server_name ${EX.host};

    ssl_certificate     /etc/letsencrypt/live/${EX.host}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${EX.host}/privkey.pem;

    location / {
        proxy_pass http://192.168.1.50:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

server {
    listen 80;
    server_name ${EX.host};
    return 301 https://$host$request_uri;
}`}
      />
      <CodeBlock title="check and reload" code={`nginx -t && systemctl reload nginx`} />

      <h2>3. Renewal</h2>
      <p>
        The certbot package installs a timer that runs <code>certbot renew</code> twice a day. The
        ACME server, the EAB and the <code>--deploy-hook</code> are remembered: Nginx is reloaded
        on every renewal. Dry run:
      </p>
      <CodeBlock title="certbot" code={`certbot renew --dry-run`} />

      <h2>Variants</h2>
      <ul>
        <li>
          <b>acme.sh</b> instead of certbot: same principle, see{' '}
          <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>.
        </li>
        <li>
          <b>Nginx in a container</b>: run certbot on the host (or in its own container) with{' '}
          <code>/etc/letsencrypt</code> mounted in both, and replace the hook with{' '}
          <code>docker exec nginx nginx -s reload</code>.
        </li>
      </ul>
      <Callout title="Native ACME module">
        Recent Nginx versions offer a built-in ACME module (<code>ngx_http_acme_module</code>). It
        accepts a custom CA URL and, depending on the version, EAB. If you use it, point its issuer
        at the directory above and check its documentation for the EAB directive in your version.
      </Callout>
    </>
  );
}

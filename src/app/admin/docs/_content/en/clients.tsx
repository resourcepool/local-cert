import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Clients({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>certbot, acme.sh, lego</h1>
      <p className="lead">
        The three command-line clients. They are enough to equip any machine, and most of the
        integrations in the other guides rely on one of them.
      </p>
      <EabValues ctx={ctx} />

      <Callout title="The challenge is never fetched">
        local-cert never comes to read the HTTP-01 response. You can therefore use <b>webroot</b>{' '}
        mode with any folder, even one that no web server serves: it is the simplest option when
        port 80 is already taken.
      </Callout>

      <h2>certbot</h2>
      <p>Port 80 free on the machine: standalone mode.</p>
      <CodeBlock
        title="certbot — standalone"
        code={`certbot certonly --standalone -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} \\
  --email ${EX.email} --agree-tos --no-eff-email`}
      />
      <p>Port 80 in use: webroot mode, pointing to an empty folder.</p>
      <CodeBlock
        title="certbot — webroot"
        code={`mkdir -p /var/lib/letsencrypt/webroot
certbot certonly --webroot -w /var/lib/letsencrypt/webroot -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} \\
  --email ${EX.email} --agree-tos --no-eff-email \\
  --deploy-hook "systemctl reload nginx"`}
      />
      <p>
        The files end up in <code>/etc/letsencrypt/live/{EX.host}/</code>. The server and the EAB
        are remembered in the renewal file: the <code>certbot renew</code> timer installed by the
        package renews with no further setup. Check with <code>certbot renew --dry-run</code>.
      </p>

      <h2>acme.sh</h2>
      <p>Registering the account is a separate step, done once per machine.</p>
      <CodeBlock
        title="acme.sh"
        code={`# 1. account, with the EAB
acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} -m ${EX.email}

# 2. issuance (webroot pointing to an empty folder)
mkdir -p /var/lib/acme-webroot
acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /var/lib/acme-webroot

# 3. install the files and set the reload command
acme.sh --install-cert -d ${EX.host} \\
  --key-file       /etc/ssl/private/${EX.host}.key \\
  --fullchain-file /etc/ssl/certs/${EX.host}.pem \\
  --reloadcmd      "systemctl reload nginx"`}
      />
      <p>
        With port 80 free, replace <code>-w …</code> with <code>--standalone</code> (
        <code>socat</code> required). Renewal runs through the cron job installed by acme.sh, so
        the webroot folder must exist permanently — hence a path outside <code>/tmp</code>.
      </p>

      <h2>lego</h2>
      <CodeBlock
        title="lego"
        code={`lego --server ${ctx.directory} \\
  --eab --kid ${EX.kid} --hmac ${EX.hmac} \\
  --email ${EX.email} --accept-tos \\
  --http --domains ${EX.host} \\
  run`}
      />
      <p>
        The files end up in <code>./.lego/certificates/</code>. lego doesn&apos;t install a
        scheduled job: schedule the same command yourself, ending with{' '}
        <code>renew --days 30</code>. With port 80 in use, add{' '}
        <code>--http.webroot /var/lib/acme-webroot</code>.
      </p>

      <h2>Verify</h2>
      <CodeBlock
        title="openssl"
        code={`openssl x509 -in /etc/letsencrypt/live/${EX.host}/fullchain.pem -noout -issuer -subject -enddate`}
      />
      <p>
        The issuer must be Let&apos;s Encrypt (or <i>(STAGING)</i> while local-cert is on the test
        environment). The certificate also shows up in{' '}
        <Link href="/admin/certificates">Certificates</Link>.
      </p>
    </>
  );
}

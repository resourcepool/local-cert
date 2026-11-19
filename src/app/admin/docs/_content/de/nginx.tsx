import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Nginx({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Nginx</h1>
      <p className="lead">
        In den meisten Installationen fordert Nginx Zertifikate nicht selbst an: Ein ACME-Client
        läuft nebenher, schreibt die Dateien und lädt Nginx neu. certbot ist die übliche Wahl.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Das Zertifikat beschaffen</h2>
      <p>
        Nginx belegt Port 80: Verwenden Sie den Webroot-Modus mit einem leeren Ordner. Er muss
        nicht von Nginx ausgeliefert werden, local-cert liest dort nichts.
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

      <h2>2. Nginx damit verbinden</h2>
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
      <CodeBlock title="prüfen und neu laden" code={`nginx -t && systemctl reload nginx`} />

      <h2>3. Erneuerung</h2>
      <p>
        Das certbot-Paket installiert einen Timer, der <code>certbot renew</code> zweimal täglich
        ausführt. ACME-Server, EAB und der <code>--deploy-hook</code> sind gespeichert: Nginx wird
        bei jeder Erneuerung neu geladen. Testlauf:
      </p>
      <CodeBlock title="certbot" code={`certbot renew --dry-run`} />

      <h2>Varianten</h2>
      <ul>
        <li>
          <b>acme.sh</b> statt certbot: gleiches Prinzip, siehe{' '}
          <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>.
        </li>
        <li>
          <b>Nginx im Container</b>: Lassen Sie certbot auf dem Host (oder in einem eigenen
          Container) laufen, mit <code>/etc/letsencrypt</code> in beide eingebunden, und ersetzen
          Sie den Hook durch <code>docker exec nginx nginx -s reload</code>.
        </li>
      </ul>
      <Callout title="Natives ACME-Modul">
        Neuere Nginx-Versionen bieten ein integriertes ACME-Modul (
        <code>ngx_http_acme_module</code>). Es akzeptiert eine benutzerdefinierte CA-URL und, je
        nach Version, EAB. Wenn Sie es verwenden, richten Sie seinen Aussteller auf das obige
        Directory aus und lesen Sie in der Dokumentation nach, welche EAB-Direktive Ihre Version
        kennt.
      </Callout>
    </>
  );
}

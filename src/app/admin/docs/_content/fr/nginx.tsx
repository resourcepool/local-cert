import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Nginx({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Nginx</h1>
      <p className="lead">
        Nginx ne demande pas de certificats lui-même dans la plupart des installations : un client
        ACME tourne à côté, écrit les fichiers et recharge Nginx. certbot est le choix habituel.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Obtenir le certificat</h2>
      <p>
        Nginx occupe le port 80 : utilisez le mode webroot vers un dossier vide. Il n&apos;a pas
        besoin d&apos;être servi par Nginx, local-cert ne vient pas y lire.
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

      <h2>2. Brancher Nginx dessus</h2>
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
      <CodeBlock title="vérifier et recharger" code={`nginx -t && systemctl reload nginx`} />

      <h2>3. Renouvellement</h2>
      <p>
        Le paquet certbot installe un timer qui lance <code>certbot renew</code> deux fois par
        jour. Le serveur ACME, l&apos;EAB et le <code>--deploy-hook</code> sont mémorisés : Nginx
        est rechargé à chaque renouvellement. Test à blanc :
      </p>
      <CodeBlock title="certbot" code={`certbot renew --dry-run`} />

      <h2>Variantes</h2>
      <ul>
        <li>
          <b>acme.sh</b> plutôt que certbot : même principe, voir{' '}
          <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>.
        </li>
        <li>
          <b>Nginx en conteneur</b> : faites tourner certbot sur l&apos;hôte (ou dans son propre
          conteneur) avec <code>/etc/letsencrypt</code> monté dans les deux, et remplacez le hook
          par <code>docker exec nginx nginx -s reload</code>.
        </li>
      </ul>
      <Callout title="Module ACME natif">
        Les versions récentes de Nginx proposent un module ACME intégré (
        <code>ngx_http_acme_module</code>). Il accepte une URL de CA personnalisée et, selon la
        version, l&apos;EAB. Si vous l&apos;utilisez, pointez son émetteur sur le directory
        ci-dessus et consultez sa documentation pour la directive EAB de votre version.
      </Callout>
    </>
  );
}

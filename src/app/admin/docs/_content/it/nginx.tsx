import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Nginx({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Nginx</h1>
      <p className="lead">
        Nella maggior parte delle installazioni Nginx non richiede certificati da solo: un client
        ACME gira accanto, scrive i file e ricarica Nginx. certbot è la scelta abituale.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Ottenere il certificato</h2>
      <p>
        Nginx occupa la porta 80: usare la modalità webroot verso una cartella vuota. Non occorre
        che sia servita da Nginx, local-cert non vi legge nulla.
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

      <h2>2. Collegare Nginx</h2>
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
      <CodeBlock title="verificare e ricaricare" code={`nginx -t && systemctl reload nginx`} />

      <h2>3. Rinnovo</h2>
      <p>
        Il pacchetto certbot installa un timer che esegue <code>certbot renew</code> due volte al
        giorno. Il server ACME, l&apos;EAB e il <code>--deploy-hook</code> sono memorizzati:
        Nginx viene ricaricato a ogni rinnovo. Prova a vuoto:
      </p>
      <CodeBlock title="certbot" code={`certbot renew --dry-run`} />

      <h2>Varianti</h2>
      <ul>
        <li>
          <b>acme.sh</b> al posto di certbot: stesso principio, vedere{' '}
          <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>.
        </li>
        <li>
          <b>Nginx in un container</b>: eseguire certbot sull&apos;host (o nel proprio container)
          con <code>/etc/letsencrypt</code> montato in entrambi, e sostituire l&apos;hook con{' '}
          <code>docker exec nginx nginx -s reload</code>.
        </li>
      </ul>
      <Callout title="Modulo ACME nativo">
        Le versioni recenti di Nginx offrono un modulo ACME integrato (
        <code>ngx_http_acme_module</code>). Accetta un URL di CA personalizzato e, a seconda della
        versione, l&apos;EAB. Se lo si usa, puntare il suo emittente alla directory indicata sopra
        e consultarne la documentazione per la direttiva EAB della propria versione.
      </Callout>
    </>
  );
}

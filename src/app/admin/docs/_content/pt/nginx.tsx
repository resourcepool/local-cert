import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Nginx({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Nginx</h1>
      <p className="lead">
        Na maioria das instalações, o Nginx não pede certificados por si próprio: um cliente ACME
        corre ao lado, escreve os ficheiros e recarrega o Nginx. O certbot é a escolha habitual.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Obter o certificado</h2>
      <p>
        O Nginx ocupa a porta 80: utilize o modo webroot apontando para uma pasta vazia. Não
        precisa de ser servida pelo Nginx, o local-cert não vai lá ler nada.
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

      <h2>2. Ligar o Nginx ao certificado</h2>
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
      <CodeBlock title="verificar e recarregar" code={`nginx -t && systemctl reload nginx`} />

      <h2>3. Renovação</h2>
      <p>
        O pacote certbot instala um temporizador que executa <code>certbot renew</code> duas vezes
        por dia. O servidor ACME, o EAB e o <code>--deploy-hook</code> ficam memorizados: o Nginx é
        recarregado a cada renovação. Teste em simulação:
      </p>
      <CodeBlock title="certbot" code={`certbot renew --dry-run`} />

      <h2>Variantes</h2>
      <ul>
        <li>
          <b>acme.sh</b> em vez do certbot: o mesmo princípio, ver{' '}
          <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>.
        </li>
        <li>
          <b>Nginx num contentor</b>: execute o certbot no anfitrião (ou no seu próprio contentor)
          com <code>/etc/letsencrypt</code> montado em ambos, e substitua o hook por{' '}
          <code>docker exec nginx nginx -s reload</code>.
        </li>
      </ul>
      <Callout title="Módulo ACME nativo">
        As versões recentes do Nginx oferecem um módulo ACME integrado (
        <code>ngx_http_acme_module</code>). Aceita um URL de CA personalizado e, consoante a
        versão, o EAB. Se o utilizar, aponte o seu emissor para o directory acima e consulte a
        respetiva documentação para a diretiva EAB da sua versão.
      </Callout>
    </>
  );
}

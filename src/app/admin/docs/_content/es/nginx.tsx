import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Nginx({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Nginx</h1>
      <p className="lead">
        En la mayoría de las instalaciones, Nginx no solicita certificados por sí mismo: un
        cliente ACME se ejecuta a su lado, escribe los archivos y recarga Nginx. certbot es la
        opción habitual.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Obtener el certificado</h2>
      <p>
        Nginx ocupa el puerto 80: utilice el modo webroot con una carpeta vacía. No es necesario
        que Nginx la sirva; local-cert no va a leerla.
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

      <h2>2. Conectar Nginx</h2>
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
      <CodeBlock title="verificar y recargar" code={`nginx -t && systemctl reload nginx`} />

      <h2>3. Renovación</h2>
      <p>
        El paquete certbot instala un temporizador que ejecuta <code>certbot renew</code> dos
        veces al día. El servidor ACME, el EAB y el <code>--deploy-hook</code> quedan memorizados:
        Nginx se recarga en cada renovación. Prueba en seco:
      </p>
      <CodeBlock title="certbot" code={`certbot renew --dry-run`} />

      <h2>Variantes</h2>
      <ul>
        <li>
          <b>acme.sh</b> en lugar de certbot: mismo principio, véase{' '}
          <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>.
        </li>
        <li>
          <b>Nginx en contenedor</b>: ejecute certbot en el host (o en su propio contenedor) con{' '}
          <code>/etc/letsencrypt</code> montado en ambos, y sustituya el hook por{' '}
          <code>docker exec nginx nginx -s reload</code>.
        </li>
      </ul>
      <Callout title="Módulo ACME nativo">
        Las versiones recientes de Nginx ofrecen un módulo ACME integrado (
        <code>ngx_http_acme_module</code>). Admite una URL de CA personalizada y, según la
        versión, EAB. Si lo utiliza, apunte su emisor al directory indicado arriba y consulte su
        documentación para conocer la directiva EAB de su versión.
      </Callout>
    </>
  );
}

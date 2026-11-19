import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Clients({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>certbot, acme.sh, lego</h1>
      <p className="lead">
        Los tres clientes de línea de comandos. Bastan para equipar cualquier máquina, y la mayoría
        de las integraciones de las demás guías se apoyan en uno de ellos.
      </p>
      <EabValues ctx={ctx} />

      <Callout title="El desafío nunca se consulta">
        local-cert no va a leer la respuesta HTTP-01. Por tanto, puede usar el modo{' '}
        <b>webroot</b> con una carpeta cualquiera, aunque ningún servidor web la sirva: es lo más
        sencillo cuando el puerto 80 ya está ocupado.
      </Callout>

      <h2>certbot</h2>
      <p>Puerto 80 libre en la máquina: modo autónomo (standalone).</p>
      <CodeBlock
        title="certbot — standalone"
        code={`certbot certonly --standalone -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} \\
  --email ${EX.email} --agree-tos --no-eff-email`}
      />
      <p>Puerto 80 ocupado: modo webroot, con una carpeta vacía.</p>
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
        Los archivos quedan en <code>/etc/letsencrypt/live/{EX.host}/</code>. El servidor y el EAB
        se memorizan en el archivo de renovación: el temporizador <code>certbot renew</code>{' '}
        instalado por el paquete renueva sin ningún ajuste adicional. Compruébelo con{' '}
        <code>certbot renew --dry-run</code>.
      </p>

      <h2>acme.sh</h2>
      <p>El registro de la cuenta es un paso aparte, que se realiza una vez por máquina.</p>
      <CodeBlock
        title="acme.sh"
        code={`# 1. cuenta, con el EAB
acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} -m ${EX.email}

# 2. emisión (webroot con una carpeta vacía)
mkdir -p /var/lib/acme-webroot
acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /var/lib/acme-webroot

# 3. instalación de los archivos y comando de recarga
acme.sh --install-cert -d ${EX.host} \\
  --key-file       /etc/ssl/private/${EX.host}.key \\
  --fullchain-file /etc/ssl/certs/${EX.host}.pem \\
  --reloadcmd      "systemctl reload nginx"`}
      />
      <p>
        Con el puerto 80 libre, sustituya <code>-w …</code> por <code>--standalone</code> (
        <code>socat</code> es necesario). La renovación se realiza mediante la tarea cron que
        instala acme.sh; por eso la carpeta webroot debe existir de forma permanente, de ahí una
        ruta fuera de <code>/tmp</code>.
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
        Los archivos quedan en <code>./.lego/certificates/</code>. lego no instala ninguna tarea
        programada: programe usted mismo el mismo comando terminado en{' '}
        <code>renew --days 30</code>. Con el puerto 80 ocupado, añada{' '}
        <code>--http.webroot /var/lib/acme-webroot</code>.
      </p>

      <h2>Verificar</h2>
      <CodeBlock
        title="openssl"
        code={`openssl x509 -in /etc/letsencrypt/live/${EX.host}/fullchain.pem -noout -issuer -subject -enddate`}
      />
      <p>
        El emisor debe ser Let&apos;s Encrypt (o <i>(STAGING)</i> mientras local-cert esté en
        entorno de pruebas). El certificado también aparece en{' '}
        <Link href="/admin/certificates">Certificados</Link>.
      </p>
    </>
  );
}

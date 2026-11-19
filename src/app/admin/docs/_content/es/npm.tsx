import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function NginxProxyManager({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Nginx Proxy Manager</h1>
      <p className="lead">
        La interfaz de Nginx Proxy Manager no permite elegir ni el servidor ACME ni un EAB: su
        emisión integrada solo habla con Let&apos;s Encrypt. Por eso el certificado se obtiene
        aparte y después se importa como certificado personalizado.
      </p>

      <h2>1. Obtener el certificado</h2>
      <p>
        En el host, con acme.sh (véase{' '}
        <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link> para más detalle):
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

      <h2>2. Importarlo</h2>
      <ol>
        <li>
          <b>SSL Certificates</b> → <b>Add SSL Certificate</b> → <b>Custom</b>.
        </li>
        <li>
          Clave: <code>{EX.host}.key</code>. Certificado: <code>{EX.host}.pem</code>.
        </li>
        <li>
          En el <b>Proxy Host</b>, pestaña <b>SSL</b>, seleccione este certificado.
        </li>
      </ol>

      <Callout kind="warn" title="La renovación no es automática">
        acme.sh renueva los archivos, pero Nginx Proxy Manager conserva la copia importada. Cada
        dos meses aproximadamente, vuelva a importar el certificado o, si puede elegir, prefiera
        un proxy que hable ACME con una CA personalizada (Traefik, Caddy), donde todo es
        automático.
      </Callout>

      <h2>Otra vía: dejar que local-cert gestione la clave</h2>
      <p>
        A través de la <Link href="/admin/api">API</Link>, local-cert genera la clave, renueva por
        sí solo y expone el certificado actualizado. A un script programado solo le queda
        descargar el bundle y enviarlo a Nginx Proxy Manager. Véase{' '}
        <Link href="/admin/docs/acme/others">Otros sistemas</Link>.
      </p>
    </>
  );
}

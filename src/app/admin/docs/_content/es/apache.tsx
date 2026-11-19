import { CodeBlock } from '@/components/ui';
import { EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Apache({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Apache httpd</h1>
      <p className="lead">
        El módulo <code>mod_md</code>, incluido con Apache 2.4, gestiona ACME directamente en el
        servidor. EAB es compatible a partir de Apache 2.4.52.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Activar los módulos</h2>
      <CodeBlock title="Debian / Ubuntu" code={`a2enmod md ssl && systemctl restart apache2`} />

      <h2>2. Configurar</h2>
      <CodeBlock
        title="/etc/apache2/conf-available/local-cert.conf"
        code={`MDCertificateAuthority   ${ctx.directory}
MDCertificateAgreement   accepted
MDContactEmail           ${EX.email}
MDExternalAccountBinding ${EX.kid} ${EX.hmac}
MDCAChallenges           http-01

MDomain ${EX.host}

<VirtualHost *:443>
    ServerName ${EX.host}
    SSLEngine on
    # sin SSLCertificateFile: mod_md proporciona el certificado
    ProxyPass        / http://192.168.1.50:5000/
    ProxyPassReverse / http://192.168.1.50:5000/
</VirtualHost>

<VirtualHost *:80>
    ServerName ${EX.host}
</VirtualHost>`}
      />
      <CodeBlock title="activar" code={`a2enconf local-cert && systemctl reload apache2`} />

      <h2>3. Dejar que actúe y recargar</h2>
      <p>
        mod_md obtiene el certificado en segundo plano y después espera a una recarga para
        activarlo. Siga el progreso en el registro de errores; cuando indique que el certificado
        está listo:
      </p>
      <CodeBlock title="recargar" code={`systemctl reload apache2`} />
      <p>
        Las renovaciones siguen el mismo esquema: obtención automática y activación en la
        siguiente recarga. Basta con una recarga diaria mediante cron.
      </p>

      <h2>Conviene saber</h2>
      <ul>
        <li>
          Para no escribir la clave HMAC en la configuración,{' '}
          <code>MDExternalAccountBinding</code> también acepta la ruta de un archivo JSON{' '}
          <code>{'{"kid": "…", "hmac": "…"}'}</code>, legible únicamente por root.
        </li>
        <li>
          Si mod_md ya gestiona dominios públicos con Let&apos;s Encrypt, coloque estas
          directivas dentro de un bloque <code>&lt;MDomain {EX.host}&gt; … &lt;/MDomain&gt;</code>{' '}
          para aplicarlas solo a los nombres internos.
        </li>
      </ul>
    </>
  );
}

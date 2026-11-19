import { CodeBlock } from '@/components/ui';
import { EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Apache({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Apache httpd</h1>
      <p className="lead">
        O módulo <code>mod_md</code>, fornecido com o Apache 2.4, trata do ACME diretamente no
        servidor. O EAB é suportado a partir do Apache 2.4.52.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Ativar os módulos</h2>
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
    # sem SSLCertificateFile: o mod_md fornece o certificado
    ProxyPass        / http://192.168.1.50:5000/
    ProxyPassReverse / http://192.168.1.50:5000/
</VirtualHost>

<VirtualHost *:80>
    ServerName ${EX.host}
</VirtualHost>`}
      />
      <CodeBlock title="ativar" code={`a2enconf local-cert && systemctl reload apache2`} />

      <h2>3. Deixar fazer e depois recarregar</h2>
      <p>
        O mod_md obtém o certificado em segundo plano e depois aguarda um recarregamento para o
        ativar. Acompanhe o progresso no registo de erros; quando este anunciar que o certificado
        está pronto:
      </p>
      <CodeBlock title="recarregar" code={`systemctl reload apache2`} />
      <p>
        As renovações seguem o mesmo esquema: obtenção automática, ativação no recarregamento
        seguinte. Um recarregamento diário por cron é suficiente.
      </p>

      <h2>A ter em conta</h2>
      <ul>
        <li>
          Para não escrever a chave HMAC na configuração, <code>MDExternalAccountBinding</code>{' '}
          aceita também o caminho de um ficheiro JSON{' '}
          <code>{'{"kid": "…", "hmac": "…"}'}</code>, legível apenas pelo root.
        </li>
        <li>
          Se o mod_md já gere domínios públicos no Let&apos;s Encrypt, coloque estas diretivas
          num bloco <code>&lt;MDomain {EX.host}&gt; … &lt;/MDomain&gt;</code> para as aplicar
          apenas aos nomes internos.
        </li>
      </ul>
    </>
  );
}

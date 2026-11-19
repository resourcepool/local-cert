import { CodeBlock } from '@/components/ui';
import { EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Apache({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Apache httpd</h1>
      <p className="lead">
        The <code>mod_md</code> module, shipped with Apache 2.4, handles ACME directly inside the
        server. EAB is supported from Apache 2.4.52.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Enable the modules</h2>
      <CodeBlock title="Debian / Ubuntu" code={`a2enmod md ssl && systemctl restart apache2`} />

      <h2>2. Configure</h2>
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
    # no SSLCertificateFile: mod_md provides the certificate
    ProxyPass        / http://192.168.1.50:5000/
    ProxyPassReverse / http://192.168.1.50:5000/
</VirtualHost>

<VirtualHost *:80>
    ServerName ${EX.host}
</VirtualHost>`}
      />
      <CodeBlock title="enable" code={`a2enconf local-cert && systemctl reload apache2`} />

      <h2>3. Let it run, then reload</h2>
      <p>
        mod_md obtains the certificate in the background, then waits for a reload to activate it.
        Follow progress in the error log; once it reports that the certificate is ready:
      </p>
      <CodeBlock title="reload" code={`systemctl reload apache2`} />
      <p>
        Renewals follow the same pattern: automatic retrieval, activation on the next reload. A
        daily reload from cron is enough.
      </p>

      <h2>Good to know</h2>
      <ul>
        <li>
          To keep the HMAC key out of the configuration, <code>MDExternalAccountBinding</code> also
          accepts the path to a JSON file <code>{'{"kid": "…", "hmac": "…"}'}</code>, readable by
          root only.
        </li>
        <li>
          If mod_md already manages public domains with Let&apos;s Encrypt, put these directives
          inside a <code>&lt;MDomain {EX.host}&gt; … &lt;/MDomain&gt;</code> block so they only
          apply to internal names.
        </li>
      </ul>
    </>
  );
}

import { CodeBlock } from '@/components/ui';
import { EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Apache({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Apache httpd</h1>
      <p className="lead">
        Il modulo <code>mod_md</code>, fornito con Apache 2.4, gestisce ACME direttamente nel
        server. L&apos;EAB è supportato a partire da Apache 2.4.52.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Attivare i moduli</h2>
      <CodeBlock title="Debian / Ubuntu" code={`a2enmod md ssl && systemctl restart apache2`} />

      <h2>2. Configurare</h2>
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
    # nessun SSLCertificateFile: il certificato lo fornisce mod_md
    ProxyPass        / http://192.168.1.50:5000/
    ProxyPassReverse / http://192.168.1.50:5000/
</VirtualHost>

<VirtualHost *:80>
    ServerName ${EX.host}
</VirtualHost>`}
      />
      <CodeBlock title="attivare" code={`a2enconf local-cert && systemctl reload apache2`} />

      <h2>3. Lasciar lavorare, poi ricaricare</h2>
      <p>
        mod_md ottiene il certificato in background, poi attende un ricaricamento per attivarlo.
        Seguire l&apos;avanzamento nel log degli errori; quando segnala che il certificato è
        pronto:
      </p>
      <CodeBlock title="ricaricare" code={`systemctl reload apache2`} />
      <p>
        I rinnovi seguono lo stesso schema: ottenimento automatico, attivazione al successivo
        ricaricamento. Un ricaricamento giornaliero tramite cron è sufficiente.
      </p>

      <h2>Da sapere</h2>
      <ul>
        <li>
          Per non scrivere la chiave HMAC nella configurazione, <code>MDExternalAccountBinding</code>{' '}
          accetta anche il percorso di un file JSON{' '}
          <code>{'{"kid": "…", "hmac": "…"}'}</code>, leggibile solo da root.
        </li>
        <li>
          Se mod_md gestisce già domini pubblici presso Let&apos;s Encrypt, collocare queste
          direttive in un blocco <code>&lt;MDomain {EX.host}&gt; … &lt;/MDomain&gt;</code> per
          applicarle solo ai nomi interni.
        </li>
      </ul>
    </>
  );
}

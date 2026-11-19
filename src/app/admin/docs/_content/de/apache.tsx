import { CodeBlock } from '@/components/ui';
import { EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Apache({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Apache httpd</h1>
      <p className="lead">
        Das mit Apache 2.4 ausgelieferte Modul <code>mod_md</code> verwaltet ACME direkt im
        Server. EAB wird ab Apache 2.4.52 unterstützt.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Die Module aktivieren</h2>
      <CodeBlock title="Debian / Ubuntu" code={`a2enmod md ssl && systemctl restart apache2`} />

      <h2>2. Konfigurieren</h2>
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
    # kein SSLCertificateFile: mod_md liefert das Zertifikat
    ProxyPass        / http://192.168.1.50:5000/
    ProxyPassReverse / http://192.168.1.50:5000/
</VirtualHost>

<VirtualHost *:80>
    ServerName ${EX.host}
</VirtualHost>`}
      />
      <CodeBlock title="Aktivieren" code={`a2enconf local-cert && systemctl reload apache2`} />

      <h2>3. Abwarten, dann neu laden</h2>
      <p>
        mod_md besorgt das Zertifikat im Hintergrund und wartet dann auf ein Neuladen, um es zu
        aktivieren. Verfolgen Sie den Fortschritt im Fehlerprotokoll; sobald es meldet, dass das
        Zertifikat bereit ist:
      </p>
      <CodeBlock title="Neu laden" code={`systemctl reload apache2`} />
      <p>
        Erneuerungen folgen demselben Schema: automatische Beschaffung, Aktivierung beim nächsten
        Neuladen. Ein tägliches Neuladen per Cron genügt.
      </p>

      <h2>Wissenswertes</h2>
      <ul>
        <li>
          Um den HMAC-Schlüssel nicht in der Konfiguration zu schreiben, akzeptiert{' '}
          <code>MDExternalAccountBinding</code> auch den Pfad einer JSON-Datei{' '}
          <code>{'{"kid": "…", "hmac": "…"}'}</code>, die nur für root lesbar ist.
        </li>
        <li>
          Verwaltet mod_md bereits öffentliche Domains bei Let&apos;s Encrypt, setzen Sie diese
          Direktiven in einen Block <code>&lt;MDomain {EX.host}&gt; … &lt;/MDomain&gt;</code>, um
          sie nur auf die internen Namen anzuwenden.
        </li>
      </ul>
    </>
  );
}

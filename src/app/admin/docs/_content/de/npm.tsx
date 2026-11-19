import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function NginxProxyManager({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Nginx Proxy Manager</h1>
      <p className="lead">
        Die Oberfläche von Nginx Proxy Manager erlaubt weder die Wahl des ACME-Servers noch eines
        EAB: Die integrierte Ausstellung spricht nur mit Let&apos;s Encrypt. Das Zertifikat wird
        daher separat beschafft und dann als benutzerdefiniertes Zertifikat importiert.
      </p>

      <h2>1. Das Zertifikat beschaffen</h2>
      <p>
        Auf dem Host, mit acme.sh (Details unter{' '}
        <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>):
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

      <h2>2. Es importieren</h2>
      <ol>
        <li>
          <b>SSL Certificates</b> → <b>Add SSL Certificate</b> → <b>Custom</b>.
        </li>
        <li>
          Schlüssel: <code>{EX.host}.key</code>. Zertifikat: <code>{EX.host}.pem</code>.
        </li>
        <li>
          Wählen Sie im <b>Proxy Host</b> im Reiter <b>SSL</b> dieses Zertifikat aus.
        </li>
      </ol>

      <Callout kind="warn" title="Die Erneuerung erfolgt nicht automatisch">
        acme.sh erneuert die Dateien, aber Nginx Proxy Manager behält die importierte Kopie.
        Importieren Sie das Zertifikat etwa alle zwei Monate erneut – oder bevorzugen Sie, wenn
        Sie die Wahl haben, einen Proxy, der ACME mit einer benutzerdefinierten CA spricht
        (Traefik, Caddy), wo alles automatisch abläuft.
      </Callout>

      <h2>Anderer Weg: local-cert den Schlüssel verwalten lassen</h2>
      <p>
        Über die <Link href="/admin/api">API</Link> erzeugt local-cert den Schlüssel, erneuert
        selbstständig und stellt das aktuelle Zertifikat bereit. Ein geplantes Skript muss nur noch
        das Bundle herunterladen und in Nginx Proxy Manager einspielen. Siehe{' '}
        <Link href="/admin/docs/acme/others">Weitere Systeme</Link>.
      </p>
    </>
  );
}

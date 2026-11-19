import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EabValues, type DocCtx } from '../../_lib/prose';

export default function Acme({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>ACME-Server</h1>
      <p className="lead">
        local-cert stellt unter <code>/acme/directory</code> einen ACME-Endpunkt (RFC 8555) bereit.
        Jedes Tool, das bei Let&apos;s Encrypt ein Zertifikat anfordern kann, kann es stattdessen
        bei local-cert anfordern – für Hosts, die Let&apos;s Encrypt nie erreichen könnte.
      </p>
      <CodeBlock title="Directory dieser Instanz" code={ctx.directory} />

      <h2>Was es ist und was nicht</h2>
      <p>
        Es ist keine Zertifizierungsstelle. local-cert signiert nichts: Es vermittelt zwischen
        Ihrem ACME-Client und Let&apos;s Encrypt, und das Zertifikat, das Sie erhalten, ist ein
        echtes Let&apos;s-Encrypt-Zertifikat, das überall anerkannt wird.
      </p>
      <p>
        Das Problem, das es löst: Ein klassischer ACME-Client beweist die Kontrolle über einen
        Namen, indem er auf Port 80 antwortet (HTTP-01), was voraussetzt, dass Let&apos;s Encrypt
        den Rechner erreichen kann. In einem LAN ist das unmöglich. Der Nachweis über DNS (DNS-01)
        funktioniert, zwingt aber dazu, jedem Rechner DNS-Credentials zu geben. local-cert behält
        diese Credentials für sich und führt den DNS-Nachweis anstelle des Clients.
      </p>

      <h2>Wie ein Zertifikat ausgestellt wird</h2>
      <ol>
        <li>
          <b>Registrierung.</b> Der Client legt sein ACME-Konto an und legt dabei EAB-Zugangsdaten
          vor. Nur ein einziges Mal; danach signiert er mit seinem eigenen Kontoschlüssel.
        </li>
        <li>
          <b>Bestellung.</b> Der Client fordert ein Zertifikat für einen oder mehrere Namen an.
          local-cert prüft, ob sie zu einer verwalteten Domain gehören und ob die EAB-Zugangsdaten
          dafür berechtigt sind. Andernfalls wird die Bestellung sofort abgelehnt.
        </li>
        <li>
          <b>Challenge.</b> local-cert bietet wie eine gewöhnliche CA eine HTTP-01-Challenge an.
          Der Client bereitet seine Antwort vor und meldet, dass er bereit ist.
        </li>
        <li>
          <b>Tatsächliche Validierung.</b> local-cert ruft die HTTP-Antwort nie ab. Stattdessen
          eröffnet es eine Bestellung bei Let&apos;s Encrypt, schreibt den TXT-Eintrag{' '}
          <code>_acme-challenge</code> in Ihre Zone, wartet auf dessen Verbreitung, lässt
          validieren und löscht den Eintrag anschließend wieder. Die Challenge des Clients wechselt
          auf <code>valid</code>, sobald dies abgeschlossen ist.
        </li>
        <li>
          <b>Finalisierung.</b> Der Client sendet seinen CSR. local-cert leitet ihn an Let&apos;s
          Encrypt weiter und liefert die Zertifikatskette zurück. Der private Schlüssel hat den
          Client nie verlassen.
        </li>
      </ol>
      <Callout title="Praktische Folgen">
        <ul>
          <li>
            Port 80 des Clients muss weder für local-cert noch aus dem Internet erreichbar sein.
            Der Client muss lediglich local-cert per HTTP(S) aufrufen können.
          </li>
          <li>
            Schritt 4 dauert ein bis drei Minuten: Das ist die Zeit der DNS-Verbreitung. Die
            Clients warten von selbst; verkürzen Sie ihre Timeouts nicht.
          </li>
          <li>
            Es wird nur HTTP-01 angeboten. Ein Client, der ausschließlich für DNS-01 oder
            TLS-ALPN-01 konfiguriert ist, findet keine kompatible Challenge.
          </li>
        </ul>
      </Callout>

      <h2>Die EAB-Zugangsdaten</h2>
      <p>
        EAB steht für <i>External Account Binding</i>. Es ist der von ACME vorgesehene Mechanismus,
        damit eine CA nur Clients akzeptiert, die sie bereits kennt: Beim Anlegen seines Kontos
        weist der Client nach, dass er ein vorab ausgehändigtes Geheimnis besitzt. Hier ersetzt
        es den API-Schlüssel.
      </p>
      <p>EAB-Zugangsdaten bestehen aus zwei Werten sowie der URL des Servers:</p>
      <EabValues ctx={ctx} />
      <p>
        Sie werden unter <Link href="/admin/keys">Schlüssel &amp; Rechte</Link> →{' '}
        <b>EAB-Zugangsdaten</b> → <b>+ Neue Zugangsdaten</b> angelegt, mit:
      </p>
      <ul>
        <li>
          einem <b>Namen</b>, damit klar bleibt, an welchen Client sie ausgegeben wurden;
        </li>
        <li>
          einem optionalen <b>Ablaufdatum</b>;
        </li>
        <li>
          den <b>erlaubten Domains</b>: Der Client kann nur Zertifikate unterhalb dieser Domains
          anfordern.
        </li>
      </ul>
      <h3>Was man wissen sollte</h3>
      <ul>
        <li>
          Der HMAC-Schlüssel wird nur einmal angezeigt. Geht er verloren, müssen neue
          Zugangsdaten angelegt werden.
        </li>
        <li>
          Der Client benötigt sie nur bei der Registrierung, aber local-cert liest die
          Zugangsdaten bei jeder Anfrage erneut: Sie zu <b>widerrufen</b> oder{' '}
          <b>ablaufen</b> zu lassen, sperrt auch bereits registrierte Clients.
        </li>
        <li>
          Dieselben Zugangsdaten können von mehreren Clients genutzt werden. Mit einem Satz pro
          Client lassen sich diese getrennt sperren, und es ist nachvollziehbar, wer was
          ausgestellt hat.
        </li>
        <li>
          Der Schlüssel ist base64url-kodiert, dem von allen Clients erwarteten Format (
          <code>hmacEncoded</code>, <code>--eab-hmac-key</code>, <code>mac_key</code> …).
        </li>
      </ul>

      <h2>Was der Client können muss</h2>
      <p>Drei Dinge, die nahezu alle modernen ACME-Clients bieten:</p>
      <ol>
        <li>eine benutzerdefinierte Directory-URL verwenden;</li>
        <li>sich mit einem External Account Binding registrieren;</li>
        <li>eine HTTP-01-Challenge lösen.</li>
      </ol>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Unterstützung</th>
              <th>Anleitung</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Traefik', 'nativ', 'acme/traefik'],
              ['Caddy', 'nativ', 'acme/caddy'],
              ['Apache httpd', 'nativ (mod_md)', 'acme/apache'],
              ['Nginx', 'über certbot oder acme.sh', 'acme/nginx'],
              ['HAProxy', 'über acme.sh', 'acme/haproxy'],
              ['Nginx Proxy Manager', 'manueller Import', 'acme/nginx-proxy-manager'],
              ['Kubernetes', 'nativ (cert-manager)', 'acme/kubernetes'],
              ['Dokploy', 'nativ (Traefik)', 'acme/dokploy'],
              ['Coolify', 'nativ (Traefik)', 'acme/coolify'],
              ['Synology DSM', 'über acme.sh', 'acme/synology'],
              ['Proxmox VE', 'nativ (pvenode)', 'acme/proxmox'],
              ['certbot, acme.sh, lego', 'nativ', 'acme/clients'],
            ].map(([tool, support, slug]) => (
              <tr key={slug}>
                <td>{tool}</td>
                <td>{support}</td>
                <td>
                  <Link href={`/admin/docs/${slug}`}>öffnen</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Für alles andere siehe <Link href="/admin/docs/acme/others">Weitere Systeme</Link>.
      </p>

      <h2>Regeln und Grenzen</h2>
      <ul>
        <li>
          Ein Name außerhalb der verwalteten Domains wird abgelehnt (<code>rejectedIdentifier</code>
          ); ebenso eine für die Zugangsdaten nicht freigegebene Domain (<code>unauthorized</code>).
        </li>
        <li>Alle Namen einer Bestellung müssen zur selben verwalteten Domain gehören.</li>
        <li>
          Wildcards (<code>*.home.example.com</code>) werden akzeptiert: Da die tatsächliche
          Validierung per DNS-01 erfolgt, greift die übliche Einschränkung von HTTP-01 nicht. Einige
          Clients lehnen eine Wildcard bei HTTP-01 allerdings von sich aus ab.
        </li>
        <li>
          Diese Zertifikate erscheinen unter <Link href="/admin/certificates">Zertifikate</Link>{' '}
          mit dem Schlüsseltyp <code>external</code>, ohne privaten Schlüssel und ohne automatische
          Erneuerung: Der Client erneuert.
        </li>
        <li>
          Ein ACME-Konto kann die von ihm erhaltenen Zertifikate widerrufen. Die Rotation des
          Kontoschlüssels (<code>keyChange</code>) ist nicht implementiert.
        </li>
      </ul>

      <h2>Fehlerbehebung</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symptom</th>
              <th>Ursache</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>JWS &quot;url&quot; is … but this endpoint is …</code>
              </td>
              <td>
                local-cert steht hinter einem Proxy, der <code>X-Forwarded-Proto</code> /{' '}
                <code>X-Forwarded-Host</code> nicht weiterreicht. Reichen Sie sie weiter oder
                setzen Sie die Variable <code>PUBLIC_URL</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>externalAccountRequired</code>
              </td>
              <td>Der Client registriert sich ohne EAB. Prüfen Sie seine Konfiguration.</td>
            </tr>
            <tr>
              <td>
                <code>unauthorized</code> bei der Registrierung
              </td>
              <td>Zugangsdaten unbekannt, widerrufen oder abgelaufen, oder falscher HMAC-Schlüssel.</td>
            </tr>
            <tr>
              <td>
                <code>rejectedIdentifier</code>
              </td>
              <td>Der angeforderte Name liegt unter keiner verwalteten Domain.</td>
            </tr>
            <tr>
              <td>Der Client gibt nach ca. 1 Minute auf</td>
              <td>
                Sein Timeout ist kürzer als die DNS-Validierung. Starten Sie erneut: Die laufende
                Bestellung wird fortgesetzt.
              </td>
            </tr>
            <tr>
              <td>TLS-Fehler zu local-cert</td>
              <td>
                local-cert wird mit einem Zertifikat ausgeliefert, das der Client nicht kennt.
                Liefern Sie es mit einem öffentlichen Zertifikat aus oder fügen Sie seine CA dem
                Zertifikatsspeicher des Clients hinzu.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

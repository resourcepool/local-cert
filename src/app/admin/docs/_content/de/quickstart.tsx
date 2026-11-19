import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function Quickstart({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Schnellstart</h1>
      <p className="lead">
        local-cert besorgt Let&apos;s-Encrypt-Zertifikate für Rechner, die aus dem Internet nicht
        erreichbar sind: NAS, Hypervisoren, interne Dienste. Die Validierung läuft über DNS
        (DNS-01), sodass nur local-cert Zugriff auf Ihre Zone benötigt.
      </p>

      <h2>Der vollständige Ablauf</h2>
      <ol>
        <li>
          <b>DNS-Provider einrichten.</b> Das ist das Konto beim Anbieter Ihrer Zone samt
          Zugangsdaten: AWS, OVHcloud, Gandi, GoDaddy oder Google Cloud. Seite{' '}
          <Link href="/admin/providers">Provider</Link>, Anleitungen{' '}
          <Link href="/admin/docs/providers">DNS-Provider</Link>.
        </li>
        <li>
          <b>Domain hinzufügen.</b> Sie wählen eine Zone des Providers aus, local-cert erzeugt die
          einzufügende IAM-Richtlinie, prüft die Berechtigungen und speichert anschließend. Seite{' '}
          <Link href="/admin/domains">Domains</Link>, Anleitung{' '}
          <Link href="/admin/docs/domains">Domain hinzufügen</Link>.
        </li>
        <li>
          <b>Zugriff gewähren.</b> Erstellen Sie unter{' '}
          <Link href="/admin/keys">Schlüssel &amp; Rechte</Link> je nach Bedarf einen{' '}
          <b>API-Schlüssel</b> (Skripte, Agenten) oder <b>EAB-Zugangsdaten</b> (ACME-Clients:
          Traefik, Caddy, certbot …).
        </li>
        <li>
          <b>Ausstellen.</b> Über den ACME-Server oder über die API – siehe unten.
        </li>
      </ol>

      <h2>Welchen Weg wählen</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>ACME-Server</th>
              <th>REST-API</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Geeignet für</td>
              <td>einen Reverse Proxy oder ein Tool, das bereits ACME spricht</td>
              <td>ein Skript, ein Tool ohne ACME, einen Agenten (MCP)</td>
            </tr>
            <tr>
              <td>Zugriff</td>
              <td>EAB-Zugangsdaten</td>
              <td>API-Schlüssel</td>
            </tr>
            <tr>
              <td>Privater Schlüssel</td>
              <td>wird vom Client erzeugt und aufbewahrt</td>
              <td>wird von local-cert erzeugt und verschlüsselt in der Datenbank gespeichert</td>
            </tr>
            <tr>
              <td>Erneuerung</td>
              <td>durch den Client</td>
              <td>durch local-cert (<code>auto_renew</code>)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>ACME-Weg, in einem Befehl</h2>
      <p>
        Mit EAB-Zugangsdaten, die für die Domain freigegeben sind, erhält jeder ACME-Client ein
        Zertifikat. Beispiel mit certbot:
      </p>
      <CodeBlock
        title="certbot"
        code={`certbot certonly --standalone -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac}`}
      />
      <p>
        Funktionsweise und Anleitungen für einzelne Tools finden Sie unter{' '}
        <Link href="/admin/docs/acme">ACME-Server</Link>.
      </p>

      <h2>API-Weg, in einer Anfrage</h2>
      <CodeBlock
        title="curl"
        code={`curl -X POST ${ctx.origin}/api/v1/certificates \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H 'content-type: application/json' \\
  -d '{
    "domains": ["${EX.host}"],
    "key_type": "ec-256",
    "auto_renew": true,
    "dns": { "create_record": true, "target_ip": "192.168.1.50" }
  }'`}
      />
      <p>
        Die Antwort kommt sofort (<code>202</code>); die Ausstellung dauert ein bis drei Minuten.
        Alle Routen sind unter <Link href="/admin/api">API</Link> beschrieben.
      </p>

      <Callout title="Während der Tests">
        Das Badge <code>acme:staging</code> oben in der Konsole zeigt an, dass local-cert mit der
        Testumgebung von Let&apos;s Encrypt kommuniziert: Die Zertifikate werden von Browsern nicht
        anerkannt, verbrauchen aber kein Kontingent. Wechseln Sie in den Produktivbetrieb, sobald
        die Kette validiert ist.
      </Callout>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function Others({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Weitere Systeme</h1>
      <p className="lead">
        Zwei Rezepte decken alles ab, was keine eigene Anleitung hat: ein generischer ACME-Client,
        wenn das System einen akzeptiert, und die API von local-cert, wenn es nur ein Zertifikat
        importieren kann.
      </p>

      <h2>Den richtigen Fall erkennen</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Das System …</th>
              <th>Rezept</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>hat einen ACME-Client mit benutzerdefinierter CA-URL, EAB und HTTP-01</td>
              <td>
                ihn mit den drei Werten der EAB-Zugangsdaten konfigurieren, wie unter{' '}
                <Link href="/admin/docs/acme">ACME-Server</Link>
              </td>
            </tr>
            <tr>
              <td>bietet Shell-Zugriff</td>
              <td>
                acme.sh und ein Deploy-Hook – siehe{' '}
                <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>
              </td>
            </tr>
            <tr>
              <td>kann nur ein Zertifikat importieren oder nur DNS-01</td>
              <td>die API von local-cert, siehe unten</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Orientierung nach System</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>System</th>
              <th>Vorgehen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>OPNsense</td>
              <td>
                Plugin <code>os-acme-client</code>: Legen Sie ein Konto bei einer
                benutzerdefinierten CA mit der Directory-URL und den EAB-Feldern an und dann ein
                Zertifikat mit HTTP-01-Challenge. Das Plugin basiert auf acme.sh.
              </td>
            </tr>
            <tr>
              <td>pfSense</td>
              <td>
                ACME-Paket: Bietet Ihre Version einen benutzerdefinierten ACME-Server mit EAB, gilt
                dasselbe Vorgehen. Andernfalls acme.sh in der Shell und anschließend Import unter{' '}
                <b>System</b> → <b>Certificates</b>.
              </td>
            </tr>
            <tr>
              <td>TrueNAS</td>
              <td>
                Sein ACME-Client beherrscht nur DNS-01 mit eigenen Anbietern: Verwenden Sie die API
                von local-cert und importieren Sie das Zertifikat.
              </td>
            </tr>
            <tr>
              <td>Unraid, UniFi, Drucker, iDRAC/iLO, Netzwerkgeräte</td>
              <td>Zertifikatsimport: API von local-cert.</td>
            </tr>
            <tr>
              <td>Zoraxy, SWAG, auf lego oder certbot basierende Proxys</td>
              <td>
                Wenn sie CA-URL und EAB bereitstellen, der generische Fall. Andernfalls Import.
              </td>
            </tr>
            <tr>
              <td>Envoy, Proxys ohne ACME-Client</td>
              <td>
                acme.sh oder lego nebenher, Dateien in den Proxy eingebunden, Neuladen per Hook.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout title="Bevor Sie einen integrierten ACME-Client ausprobieren">
        Prüfen Sie die drei Voraussetzungen: frei wählbare Directory-URL, External Account Binding,
        HTTP-01-Challenge. Fehlt eine davon, gehen Sie direkt zur API: Das spart Zeit.
      </Callout>

      <h2>API-Rezept: local-cert behält den Schlüssel und erneuert</h2>
      <p>
        Hier spricht das Zielsystem nicht mit local-cert. local-cert erzeugt den Schlüssel,
        besorgt das Zertifikat und erneuert es, und ein Skript holt die aktuelle Version ab. Sie
        benötigen einen <b>API-Schlüssel</b> (<Link href="/admin/keys">Schlüssel &amp; Rechte</Link>
        ) mit den Rechten <code>cert:issue</code>, <code>cert:read</code> und{' '}
        <code>cert:export</code> auf die Domain.
      </p>
      <h3>1. Das Zertifikat einmalig anfordern</h3>
      <CodeBlock
        title="curl"
        code={`curl -X POST ${ctx.origin}/api/v1/certificates \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H 'content-type: application/json' \\
  -d '{"domains": ["${EX.host}"], "key_type": "ec-256", "auto_renew": true}'
# → { "id": "cert_…", "status": "pending", … }`}
      />
      <h3>2. Zertifikat und Schlüssel bei jedem Durchlauf abholen</h3>
      <CodeBlock
        title="Geplantes Skript (Cron, täglich)"
        code={`#!/bin/sh
set -eu
ID=cert_XXXXXXXXXXXXXXXX
OUT=/etc/ssl/local-cert

curl -fsS -H "Authorization: Bearer $TOKEN" \\
  "${ctx.origin}/api/v1/certificates/$ID/bundle?format=pem&include=fullchain" \\
  -o "$OUT/fullchain.pem.new"
curl -fsS -H "Authorization: Bearer $TOKEN" \\
  "${ctx.origin}/api/v1/certificates/$ID/bundle?format=pem&include=key" \\
  -o "$OUT/privkey.pem.new"

# nur neu laden, wenn sich das Zertifikat geändert hat
if ! cmp -s "$OUT/fullchain.pem.new" "$OUT/fullchain.pem"; then
  mv "$OUT/fullchain.pem.new" "$OUT/fullchain.pem"
  mv "$OUT/privkey.pem.new"  "$OUT/privkey.pem"
  # hier: der Import- oder Reload-Befehl des Zielsystems
fi`}
      />
      <p>
        Statt täglich abzufragen, akzeptiert die Anforderung eine <code>webhook_url</code>, die bei
        jeder Ausstellung und Erneuerung aufgerufen wird. Die Details der Routen finden Sie unter{' '}
        <Link href="/admin/api">API</Link>.
      </p>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout } from '../../_lib/prose';

const RIGHTS = `GET    /domain/zone
GET    /domain/zone/*
POST   /domain/zone/*
PUT    /domain/zone/*
DELETE /domain/zone/*`;

export default function Ovh() {
  return (
    <>
      <h1>OVHcloud-Provider</h1>
      <p className="lead">
        local-cert steuert die DNS-Zonen von OVHcloud über die OVH-API, mit einem auf DNS
        beschränkten Satz aus drei Schlüsseln.
      </p>

      <h2>1. Das Token erstellen</h2>
      <p>
        OVH bietet eine Seite, die die drei Schlüssel auf einmal erstellt. Öffnen Sie die Seite
        Ihrer Region, während Sie in Ihrem Konto angemeldet sind:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Konto</th>
              <th>Seite zur Erstellung</th>
              <th>Wert für „API-Region“</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Europa</td>
              <td>
                <code>https://eu.api.ovh.com/createToken/</code>
              </td>
              <td>
                <code>ovh-eu</code>
              </td>
            </tr>
            <tr>
              <td>Kanada</td>
              <td>
                <code>https://ca.api.ovh.com/createToken/</code>
              </td>
              <td>
                <code>ovh-ca</code>
              </td>
            </tr>
            <tr>
              <td>USA</td>
              <td>
                <code>https://api.us.ovhcloud.com/createToken/</code>
              </td>
              <td>
                <code>ovh-us</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ol>
        <li>
          <b>Application name</b>: <code>local-cert</code>. Beschreibung frei wählbar.
        </li>
        <li>
          <b>Validity</b>: <b>Unlimited</b>. Ein zeitlich begrenztes Token würde ohne Vorwarnung
          nicht mehr funktionieren, auch nicht für Erneuerungen.
        </li>
        <li>
          <b>Rights</b>: Fügen Sie diese fünf Zeilen hinzu (der vom Assistenten von local-cert
          angebotene Link füllt sie vorab aus):
        </li>
      </ol>
      <CodeBlock title="Zu gewährende Rechte" code={RIGHTS} />
      <ol start={4}>
        <li>
          <b>Create keys</b>. Die Seite zeigt den <b>Application Key</b>, das{' '}
          <b>Application Secret</b> und die <b>Consumer Key</b> an: Notieren Sie alle drei.
        </li>
      </ol>
      <Callout title="Auf eine einzelne Zone beschränken">
        Um nur den Zugriff auf eine Domain zu gewähren, ersetzen Sie <code>*</code> in den Rechten
        durch ihren Namen: <code>/domain/zone/example.com</code> und{' '}
        <code>/domain/zone/example.com/*</code>. Behalten Sie <code>GET /domain/zone</code> bei,
        das zum Auflisten der Zonen dient.
      </Callout>

      <h2>2. Den Provider anlegen</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>+ Neuer Provider</b> →{' '}
          <b>OVHcloud</b>.
        </li>
        <li>Wählen Sie die Region, vergeben Sie einen Namen und fügen Sie die drei Schlüssel ein.</li>
        <li>
          <b>Verbindung testen</b>: local-cert listet Ihre Zonen auf. Danach <b>Speichern</b>.
        </li>
      </ol>

      <h2>3. Eine Domain hinzufügen</h2>
      <p>
        <Link href="/admin/domains">Domains</Link> → <b>+ Domain hinzufügen</b> → dieser Provider →
        die Zone. Der Test legt einen temporären TXT-Eintrag an und löscht ihn wieder. Bei OVH sind
        keine weiteren Einstellungen nötig: Die Rechte sind die des Tokens.
      </p>

      <h2>Wissenswertes</h2>
      <ul>
        <li>
          Die Domain muss die <b>DNS-Server von OVH</b> verwenden (aktive DNS-Zone im Kundenbereich).
          Verweisen ihre Nameserver woanders hin, muss dieser andere Anbieter deklariert werden.
        </li>
        <li>
          OVH wendet eine Änderung erst nach einem „Refresh“ der Zone an; local-cert löst ihn nach
          jeder Schreiboperation aus. Die Verbreitung auf die sekundären Server kann ein bis zwei
          Minuten dauern: Das ist die normale Dauer einer Ausstellung.
        </li>
        <li>Minimale TTL: 60 Sekunden.</li>
      </ul>

      <h2>Fehlerbehebung</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Meldung</th>
              <th>Ursache</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>Invalid signature</code>
              </td>
              <td>Application Secret oder Consumer Key falsch abgetippt, oder falsche Region.</td>
            </tr>
            <tr>
              <td>
                <code>This credential is not valid</code>
              </td>
              <td>Consumer Key abgelaufen oder widerrufen: Erstellen Sie ein neues Token mit unbegrenzter Gültigkeit.</td>
            </tr>
            <tr>
              <td>
                <code>This call has not been granted</code>
              </td>
              <td>In den Rechten des Tokens fehlt eine Zeile.</td>
            </tr>
            <tr>
              <td>
                <code>This application key is invalid</code>
              </td>
              <td>Application Key aus einer anderen Region.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function Gandi() {
  return (
    <>
      <h1>Gandi-Provider</h1>
      <p className="lead">
        local-cert steuert Gandi LiveDNS mit einem Personal Access Token, das Sie auf die
        unbedingt nötigen Domains und Rechte beschränken.
      </p>

      <h2>1. Das Token erstellen</h2>
      <ol>
        <li>
          Bei Gandi: <b>Organizations</b> → die Organisation, der die Domains gehören →{' '}
          <b>Sharing</b> → <b>Personal Access Tokens</b> → <b>Create a token</b>. Direkte Adresse:{' '}
          <code>https://admin.gandi.net/organizations/account/pat</code>.
        </li>
        <li>
          <b>Name</b>: <code>local-cert</code>. <b>Expiration</b>: die längste Dauer, die Sie
          akzeptieren – mit Ablauf enden Ausstellungen und Erneuerungen.
        </li>
        <li>
          <b>Resources</b>: Beschränken Sie auf die Domains, die local-cert verwalten soll.
        </li>
        <li>
          <b>Permissions</b>: Aktivieren Sie <b>Manage domain technical configuration</b>. Die
          zugehörigen Leseberechtigungen werden automatisch mit aktiviert.
        </li>
        <li>
          <b>Create</b>, dann das Token kopieren: Es wird nur einmal angezeigt.
        </li>
      </ol>
      <Callout kind="warn" title="Nicht der alte API-Schlüssel">
        Die alten „API-Schlüssel“ von Gandi (Header <code>Apikey</code>) sind veraltet und werden
        nicht unterstützt: Es wird ein Personal Access Token benötigt.
      </Callout>

      <h2>2. Den Provider anlegen</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>+ Neuer Provider</b> →{' '}
          <b>Gandi</b>.
        </li>
        <li>Vergeben Sie einen Namen und fügen Sie das Token ein.</li>
        <li>
          <b>Verbindung testen</b>, dann <b>Speichern</b>.
        </li>
      </ol>

      <h2>3. Eine Domain hinzufügen</h2>
      <p>
        <Link href="/admin/domains">Domains</Link> → <b>+ Domain hinzufügen</b> → dieser Provider →
        die Domain. Der Test legt einen temporären TXT-Eintrag an und löscht ihn wieder.
      </p>

      <h2>Wissenswertes</h2>
      <ul>
        <li>
          Die Domain muss <b>LiveDNS</b> verwenden (Server <code>ns-*.gandi.net</code>). Eine bei
          Gandi registrierte Domain, die von externen Nameservern bedient wird, erscheint nicht in
          der Liste.
        </li>
        <li>
          <b>Minimale TTL: 300 Sekunden.</b> local-cert erhöht jeden niedrigeren Wert. Ohne
          Auswirkung auf die Ausstellung der Zertifikate.
        </li>
        <li>
          Um das Token kurz vor seinem Ablauf zu wechseln:{' '}
          <Link href="/admin/providers">Provider</Link> → <b>Bearbeiten</b>, das neue einfügen,{' '}
          <b>Testen</b>, <b>Speichern</b>.
        </li>
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
                <code>401</code>
              </td>
              <td>Token falsch abgetippt, abgelaufen oder gelöscht.</td>
            </tr>
            <tr>
              <td>
                <code>403</code>
              </td>
              <td>
                Dem Token fehlt die Berechtigung für die technische Konfiguration, oder die Domain
                gehört nicht zu seinen Ressourcen.
              </td>
            </tr>
            <tr>
              <td>Die Zonenliste ist leer</td>
              <td>Keine Domain im Geltungsbereich des Tokens verwendet LiveDNS.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

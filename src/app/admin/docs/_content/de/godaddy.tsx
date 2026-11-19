import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function GoDaddy() {
  return (
    <>
      <h1>GoDaddy-Provider</h1>
      <p className="lead">
        local-cert steuert das DNS von GoDaddy mit einem produktiven API-Schlüssel. Prüfen Sie
        zunächst, ob Ihr Konto dazu berechtigt ist: GoDaddy gibt die API nicht allen frei.
      </p>

      <Callout kind="warn" title="Voraussetzung für den API-Zugriff">
        GoDaddy beschränkt seine APIs für Domain- und DNS-Verwaltung auf Konten, die mindestens
        zehn Domains oder ein Discount-Domain-Club-Abonnement besitzen. Darunter lässt sich der
        Schlüssel zwar normal erstellen, aber jeder Aufruf antwortet mit{' '}
        <code>403 ACCESS_DENIED</code>. Trifft das auf Sie zu, besteht die dauerhafte Lösung darin,
        die betreffende Subdomain an einen unterstützten DNS-Anbieter zu delegieren – siehe unten
        auf der Seite.
      </Callout>

      <h2>1. Den Schlüssel erstellen</h2>
      <ol>
        <li>
          Öffnen Sie <code>https://developer.godaddy.com/keys</code>, angemeldet mit dem Konto, dem
          die Domains gehören.
        </li>
        <li>
          <b>Create New API Key</b>. Name: <code>local-cert</code>. Umgebung: <b>Production</b>{' '}
          (ein <i>OTE</i>-Schlüssel sieht Ihre echten Domains nicht).
        </li>
        <li>
          Kopieren Sie <b>Key</b> und <b>Secret</b>: Das Secret wird nur einmal angezeigt.
        </li>
      </ol>
      <p>
        Ein GoDaddy-Schlüssel gewährt Zugriff auf das gesamte Konto: Es gibt keine Einschränkung
        nach Domain oder Art der Operation.
      </p>

      <h2>2. Den Provider anlegen</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>+ Neuer Provider</b> →{' '}
          <b>GoDaddy</b>.
        </li>
        <li>Vergeben Sie einen Namen, fügen Sie Key und Secret ein.</li>
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
          Die Domain muss die Nameserver von GoDaddy verwenden (
          <code>ns*.domaincontrol.com</code>).
        </li>
        <li>
          <b>Minimale TTL: 600 Sekunden.</b> local-cert erhöht jeden niedrigeren Wert. Ohne
          Auswirkung auf die Ausstellung der Zertifikate.
        </li>
      </ul>

      <h2>Wenn Ihr Konto keinen API-Zugriff hat</h2>
      <p>
        Behalten Sie die Domain bei GoDaddy und delegieren Sie nur die Subdomain Ihres lokalen
        Netzes an einen Anbieter, den local-cert steuern kann:
      </p>
      <ol>
        <li>
          Legen Sie eine Zone <code>home.example.com</code> bei AWS Route53, OVHcloud, Gandi oder
          Google Cloud DNS an.
        </li>
        <li>
          Fügen Sie im GoDaddy-DNS von <code>example.com</code> pro Nameserver dieser Zone einen{' '}
          <code>NS</code>-Eintrag mit dem Namen <code>home</code> hinzu.
        </li>
        <li>Deklarieren Sie den entsprechenden Provider und fügen Sie die delegierte Domain hinzu.</li>
      </ol>

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
                <code>401 UNABLE_TO_AUTHENTICATE</code>
              </td>
              <td>Key oder Secret falsch, oder ein OTE-Schlüssel in der Produktion verwendet.</td>
            </tr>
            <tr>
              <td>
                <code>403 ACCESS_DENIED</code>
              </td>
              <td>Das Konto erfüllt die Voraussetzung für den API-Zugriff nicht.</td>
            </tr>
            <tr>
              <td>
                <code>422</code> beim Schreiben
              </td>
              <td>Wert von GoDaddy abgelehnt (TTL, Format): Die Meldung nennt das Feld.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

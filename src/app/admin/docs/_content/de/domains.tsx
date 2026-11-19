import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function Domains() {
  return (
    <>
      <h1>Domain hinzufügen</h1>
      <p className="lead">
        Eine verwaltete Domain ist ein Basisname – <code>home.example.com</code> –, unter dem
        local-cert Zertifikate ausstellen darf. Sie basiert auf einer gehosteten Zone eines
        Providers. Der Assistent auf der Seite <Link href="/admin/domains">Domains</Link> erledigt
        alles in drei Schritten.
      </p>

      <h2>Bevor Sie beginnen</h2>
      <ul>
        <li>
          Ein registrierter <Link href="/admin/docs/providers">Provider</Link>, dessen Test
          grün ist.
        </li>
        <li>
          Eine <b>öffentliche</b> Zone bei diesem Anbieter, die für den Namen autoritativ ist.
          Let&apos;s Encrypt muss den Validierungseintrag aus dem Internet lesen können: Eine
          private Zone ist nicht geeignet, auch wenn Ihre Hosts selbst privat bleiben.
        </li>
      </ul>
      <Callout title="Eine Zone für das LAN reservieren">
        Sie müssen Ihre Hauptzone nicht öffnen. Legen Sie eine Route53-Zone für{' '}
        <code>home.example.com</code> an und delegieren Sie sie von <code>example.com</code> aus
        mit vier <code>NS</code>-Einträgen: local-cert erhält dann nur Rechte für diese
        Subdomain, unabhängig davon, wo die übergeordnete Zone gehostet wird.
      </Callout>

      <h2>1. Provider auswählen</h2>
      <p>
        <b>+ Domain hinzufügen</b>, dann den Provider auswählen. local-cert fragt das Konto ab und
        zeigt die Anzahl der sichtbaren Zonen an.
      </p>

      <h2>2. Zone auswählen</h2>
      <p>
        Die Zonen des Kontos werden mit ihrer Kennung aufgelistet. Eine private Zone ist
        ausgegraut. Trägt eine Zone bereits eine verwaltete Domain, wird dies angezeigt.
      </p>
      <ul>
        <li>
          <b>Basisname</b>: standardmäßig der Name der Zone. Sie können ihn auf eine Subdomain
          einschränken (<code>lab.home.example.com</code> in der Zone{' '}
          <code>home.example.com</code>): Nur Namen darunter können ein Zertifikat erhalten.
        </li>
        <li>
          <b>Standard-TTL</b>: Lebensdauer der Einträge, die local-cert veröffentlicht. 60
          Sekunden sind ein guter Wert.
        </li>
      </ul>

      <h2>3. Rechte erteilen, testen, hinzufügen</h2>
      <p>
        local-cert testet sofort seine Rechte auf der Zone. Sind sie bereits vorhanden, bleibt nur
        noch die Bestätigung. Andernfalls zeigt der Bildschirm, was zu tun ist:
      </p>
      <ol>
        <li>
          Öffnen Sie in der AWS-Konsole die angegebene Rolle (oder den Benutzer) → Reiter{' '}
          <b>Permissions</b>.
        </li>
        <li>
          Klicken Sie auf die <b>bereits vorhandene</b> Richtlinie <code>local-cert-route53</code>
          {' '}– die zusammen mit dem Provider angelegte –, dann auf <b>Edit</b> → Reiter{' '}
          <b>JSON</b>. Fügen Sie keine zweite Richtlinie hinzu: Es ist diese, die fortgeschrieben
          wird.
        </li>
        <li>
          Ersetzen Sie den gesamten Inhalt durch das angezeigte Dokument, dann <b>Next</b> →{' '}
          <b>Save changes</b>. Es enthält die bereits für diesen Provider deklarierten Zonen{' '}
          <b>plus</b> die neue: Nichts wird entfernt.
        </li>
        <li>
          Kehren Sie zum Assistenten zurück und klicken Sie auf <b>Erneut testen</b>.
        </li>
        <li>
          Sobald alle erforderlichen Zeilen auf <code>OK</code> stehen, klicken Sie auf{' '}
          <b>Domain hinzufügen</b>.
        </li>
      </ol>

      <h3>Ohne Wartezeit hinzufügen: der Status „pending“</h3>
      <p>
        Ein Anbieter kann einige Minuten brauchen, bis eine Rechteänderung wirksam wird. Statt von
        Hand erneut zu testen, fügen Sie die Domain hinzu, obwohl der Test noch fehlschlägt
        (Schaltfläche <b>Als pending hinzufügen</b>):
      </p>
      <ul>
        <li>
          die Domain hat den Status <b>pending</b>: local-cert wiederholt den Test jede Minute,
          fünfmal, und setzt sie auf <b>active</b>, sobald er gelingt;
        </li>
        <li>
          nach fünf Fehlschlägen wechselt sie auf <b>error</b>, mit der zuletzt erhaltenen
          Ablehnung. Korrigieren Sie die Rechte und klicken Sie dann auf{' '}
          <b>Prüfung neu starten</b>: Ein neuer Zyklus beginnt;
        </li>
        <li>
          solange sie nicht active ist, erhält die Domain weder Zertifikate noch Einträge: Die API
          antwortet mit <code>409</code> und der ACME-Server mit{' '}
          <code>rejectedIdentifier</code>.
        </li>
      </ul>

      <Callout title="Außerhalb von AWS ist dieser Schritt kürzer">
        Bei OVHcloud, Gandi, GoDaddy und Google Cloud sind die Rechte an die Zugangsdaten des
        Providers gebunden: Es gibt keine Richtlinie einzufügen, nur den Test. Dieser legt einen
        temporären TXT-Eintrag in der Zone an und löscht ihn wieder. Die obigen Schritte und die
        folgende Tabelle beschreiben den AWS-Fall.
      </Callout>

      <h3>Was der Test prüft</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Aufruf</th>
              <th>Erforderlich</th>
              <th>Zweck</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ListResourceRecordSets</code>
              </td>
              <td>ja</td>
              <td>die Zone lesen und prüfen, ob sie den Basisnamen abdeckt</td>
            </tr>
            <tr>
              <td>
                <code>GetHostedZone</code>
              </td>
              <td>ja</td>
              <td>die bei der Validierung abzufragenden Nameserver ermitteln</td>
            </tr>
            <tr>
              <td>
                <code>GetChange</code>
              </td>
              <td>ja</td>
              <td>auf die Verbreitung einer Schreiboperation warten</td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code> (TXT)
              </td>
              <td>ja</td>
              <td>den Validierungseintrag schreiben</td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code> (A)
              </td>
              <td>nein</td>
              <td>die Adresse eines Hosts veröffentlichen, falls bei der Ausstellung gewünscht</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Das Schreibrecht wird durch das Löschen eines nicht vorhandenen Eintrags geprüft: AWS
        kontrolliert die Berechtigung, bevor es feststellt, dass nichts zu löschen ist.{' '}
        <b>Die Zone wird durch den Test nie verändert.</b>
      </p>

      <h3>Wenn der Test rot bleibt</h3>
      <ul>
        <li>
          Warten Sie einige Sekunden und testen Sie erneut: IAM verbreitet Änderungen nicht
          sofort.
        </li>
        <li>
          Prüfen Sie, ob die Richtlinie an der angegebenen Identität eingefügt wurde und nicht am
          Benutzer, obwohl der Provider über eine Rolle läuft.
        </li>
        <li>
          Schlagen alle Zeilen mit derselben Meldung fehl, liegt es am Provider selbst:
          Schaltfläche <b>Testen</b> unter <Link href="/admin/providers">Provider</Link>.
        </li>
        <li>
          Existiert in der Zone ein <code>CAA</code>-Eintrag, muss er <code>letsencrypt.org</code>{' '}
          erlauben – der Test prüft das nicht, die Ausstellung würde aber scheitern.
        </li>
      </ul>
      <p>
        <b>Trotzdem hinzufügen</b> speichert eine Domain, deren Test fehlschlägt. Nützlich, um
        eine Konfiguration vorzubereiten; solange die Rechte fehlen, gelingt jedoch keine
        Ausstellung.
      </p>

      <h2>Danach</h2>
      <ul>
        <li>
          Gewähren Sie Zugriff auf die Domain unter{' '}
          <Link href="/admin/keys">Schlüssel &amp; Rechte</Link>: ein API-Schlüssel mit seinen
          Rechten oder EAB-Zugangsdaten für einen ACME-Client.
        </li>
        <li>
          Stellen Sie ein erstes Zertifikat aus: <Link href="/admin/docs">Schnellstart</Link>.
        </li>
      </ul>

      <h2>Eine Domain entfernen</h2>
      <p>
        <b>Entfernen</b> wird abgelehnt, solange Zertifikate existieren. <b>Erzwingen</b> widerruft
        sie, bereinigt die Zone so weit wie möglich und löscht dann alles. Denken Sie danach daran,
        die Richtlinie des Providers neu zu erzeugen (Schaltfläche <b>Richtlinie</b>) und erneut in
        AWS einzufügen: Die entfernte Zone ist darin nicht mehr enthalten.
      </p>
    </>
  );
}

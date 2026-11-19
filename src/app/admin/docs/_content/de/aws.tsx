import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import {
  PLACEHOLDER_ROLE_ARN,
  PLACEHOLDER_USER_ARN,
  assumePolicy,
  permissionsPolicy,
  trustPolicy,
} from '@/lib/dns/aws-policy';
import { Callout } from '../../_lib/prose';

const json = (doc: unknown) => JSON.stringify(doc, null, 2);
const EXAMPLE = { userArn: PLACEHOLDER_USER_ARN, roleArn: PLACEHOLDER_ROLE_ARN };

export default function AwsProvider() {
  return (
    <>
      <h1>AWS-Provider</h1>
      <p className="lead">
        Ein Provider ist eine Identität in einem AWS-Konto, die local-cert verwendet, um in Route53
        zu lesen und zu schreiben. Sie legen pro Konto einen an – <code>aws-prod</code>,{' '}
        <code>aws-lab</code> – und deklarieren Ihre Domains darauf.
      </p>

      <h2>Das Modell</h2>
      <p>Drei Objekte auf AWS-Seite, jedes mit einer klaren Aufgabe:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Objekt</th>
              <th>Aufgabe</th>
              <th>Was es trägt</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>IAM-Benutzer</td>
              <td>die Identität von local-cert</td>
              <td>ein Schlüsselpaar und sonst nichts</td>
            </tr>
            <tr>
              <td>IAM-Rolle</td>
              <td>was local-cert tun darf</td>
              <td>die Route53-Richtlinie, die Sie fortschreiben</td>
            </tr>
            <tr>
              <td>Richtlinie der Rolle</td>
              <td>die Liste der erlaubten Zonen</td>
              <td>von local-cert erzeugt, von Ihnen eingefügt</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Der in local-cert gespeicherte Schlüssel gewährt also von sich aus keinerlei Rechte: Er
        erlaubt lediglich, die Rolle anzunehmen. Eine Zone hinzuzufügen bedeutet, die Richtlinie
        der Rolle zu ändern; der Schlüssel bleibt immer derselbe.
      </p>
      <p>
        Der Assistent auf der Seite <Link href="/admin/providers">Provider</Link> führt durch diese
        Schritte und erzeugt jedes Dokument mit Ihren echten Kennungen. Dieser Leitfaden erläutert
        sie im Detail.
      </p>

      <h2>1. Den IAM-Benutzer anlegen</h2>
      <ol>
        <li>
          AWS-Konsole → <b>IAM</b> → <b>Users</b> → <b>Create user</b>.
        </li>
        <li>
          Name: <code>local-cert</code>. Lassen Sie{' '}
          <i>Provide user access to the AWS Management Console</i> deaktiviert.
        </li>
        <li>
          Im Schritt „Permissions“: <b>hängen Sie nichts an</b>. Schließen Sie die Erstellung ab.
        </li>
        <li>
          Öffnen Sie den Benutzer → <b>Security credentials</b> → <b>Create access key</b> →
          Anwendungsfall <i>Application running outside AWS</i>.
        </li>
        <li>
          Notieren Sie die <b>Access key ID</b> und den <b>Secret access key</b>: Letzterer lässt
          sich danach nicht mehr abrufen.
        </li>
      </ol>

      <h2>2. Den Schlüssel in local-cert eintragen</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>+ Neuer Provider</b>.
        </li>
        <li>
          Vergeben Sie einen Namen (<code>aws-prod</code>) und fügen Sie das Schlüsselpaar ein.
        </li>
        <li>
          <b>Schlüssel prüfen</b>: local-cert ruft <code>sts:GetCallerIdentity</code> auf, wofür
          keine Berechtigung nötig ist, und zeigt den ARN des Benutzers an. Dieser ARN dient zur
          Erzeugung der weiteren Dokumente.
        </li>
      </ol>
      <p>
        Der geheime Schlüssel wird verschlüsselt in der Datenbank gespeichert (AES-256-GCM mit{' '}
        <code>MASTER_KEY</code>) und weder erneut angezeigt noch von der API zurückgegeben.
      </p>

      <h2>3. Die Rolle anlegen</h2>
      <ol>
        <li>
          <b>IAM</b> → <b>Roles</b> → <b>Create role</b> → <b>Custom trust policy</b>.
        </li>
        <li>
          Fügen Sie die vom Assistenten angezeigte <b>Vertrauensrichtlinie</b> ein. Sie erlaubt
          ausschließlich Ihrem Benutzer, die Rolle anzunehmen:
        </li>
      </ol>
      <CodeBlock title="Vertrauensrichtlinie (Beispiel)" code={json(trustPolicy(PLACEHOLDER_USER_ARN))} />
      <ol start={3}>
        <li>
          Im Schritt „Permissions“: Fügen Sie keine verwaltete Richtlinie hinzu.
        </li>
        <li>
          Rollenname: <code>local-cert-dns</code>. Legen Sie sie an.
        </li>
        <li>
          Öffnen Sie die Rolle → <b>Permissions</b> → <b>Add permissions</b> →{' '}
          <b>Create inline policy</b> → Reiter <b>JSON</b>, und fügen Sie die{' '}
          <b>Berechtigungsrichtlinie</b> des Assistenten ein. Zu diesem Zeitpunkt enthält sie nur
          das Nötigste, um die Zonen aufzulisten:
        </li>
      </ol>
      <CodeBlock title="Anfängliche Berechtigungsrichtlinie" code={json(permissionsPolicy([], EXAMPLE))} />
      <ol start={6}>
        <li>
          Benennen Sie die Richtlinie (<code>local-cert-route53</code>), speichern Sie und kopieren
          Sie dann den <b>ARN der Rolle</b> in den Assistenten.
        </li>
      </ol>

      <h2>4. Testen und speichern</h2>
      <p>
        <b>Verbindung testen</b> führt drei Prüfungen nacheinander aus, jede baut auf der
        vorherigen auf:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Prüfung</th>
              <th>Bei Fehlschlag</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Schlüsselpaar</td>
              <td>Schlüssel unbekannt, deaktiviert oder falsch abgetippt</td>
            </tr>
            <tr>
              <td>Rolle (AssumeRole)</td>
              <td>
                falscher Rollen-ARN oder Vertrauensrichtlinie, die nicht den richtigen Benutzer
                nennt
              </td>
            </tr>
            <tr>
              <td>Zonen (ListHostedZones)</td>
              <td>Berechtigungsrichtlinie fehlt an der Rolle oder ist noch nicht wirksam</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        IAM wendet eine Änderung innerhalb weniger Sekunden an: Ein Test direkt nach dem Einfügen
        kann einmal fehlschlagen. Wenn alle drei Zeilen auf <code>OK</code> stehen, klicken Sie
        auf <b>Speichern</b>.
      </p>

      <h2>5. Domains hinzufügen</h2>
      <p>
        Der Provider kann nun Ihre Zonen auflisten, darf aber noch in keine schreiben. Diese Rechte
        werden Zone für Zone ergänzt:{' '}
        <Link href="/admin/docs/domains">Domain hinzufügen</Link>. Sobald einige Zonen deklariert
        sind, sieht die Richtlinie der Rolle so aus:
      </p>
      <CodeBlock
        title="Berechtigungsrichtlinie mit zwei Zonen (Beispiel)"
        code={json(permissionsPolicy(['Z0123456ABCDEFGHIJK', 'Z0987654ZYXWVUTSRQP'], EXAMPLE))}
      />
      <p>
        Die Schaltfläche <b>Richtlinie</b> jedes Providers erzeugt dieses Dokument jederzeit neu,
        auf Basis der tatsächlich deklarierten Domains.
      </p>

      <h2>Was die Richtlinie erlaubt</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Aktion</th>
              <th>Geltungsbereich</th>
              <th>Warum</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ListHostedZones</code>
              </td>
              <td>Konto</td>
              <td>die Zonenliste anbieten; AWS erlaubt es nicht, sie einzuschränken</td>
            </tr>
            <tr>
              <td>
                <code>GetChange</code>
              </td>
              <td>Konto</td>
              <td>warten, bis eine Schreiboperation verbreitet ist</td>
            </tr>
            <tr>
              <td>
                <code>GetHostedZone</code>, <code>ListResourceRecordSets</code>
              </td>
              <td>deklarierte Zonen</td>
              <td>
                die abzufragenden Nameserver ermitteln, die Einträge auflisten
              </td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code>
              </td>
              <td>deklarierte Zonen, Typen TXT / A / AAAA, Aktionen UPSERT / DELETE</td>
              <td>
                den Validierungs-TXT schreiben; die Adresse eines Hosts veröffentlichen, falls
                gewünscht
              </td>
            </tr>
            <tr>
              <td>
                <code>iam:ListAccessKeys</code>, <code>DeleteAccessKey</code>,{' '}
                <code>ListUserPolicies</code>, <code>DeleteUserPolicy</code>,{' '}
                <code>DeleteUser</code>
              </td>
              <td>der IAM-Benutzer des Providers, nur dieser</td>
              <td>
                optional: ihn beim Entfernen des Providers löschen (
                <a href="#nettoyage">Aufräumen</a>)
              </td>
            </tr>
            <tr>
              <td>
                <code>iam:ListRolePolicies</code>, <code>DeleteRolePolicy</code>
              </td>
              <td>die Rolle des Providers, nur diese</td>
              <td>optional: die Rolle beim Entfernen des Providers leeren</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout kind="warn" title="Wenn Sie die Richtlinie von Hand ändern">
        Zwei Fehler führen zu einem schwer lesbaren <code>AccessDenied</code>: <code>TXT</code> aus
        den erlaubten Typen zu entfernen (keine Ausstellung mehr möglich) und zwei{' '}
        <code>Condition</code>-Blöcke mit demselben Operator zu schreiben (das JSON behält nur den
        letzten). Am sichersten ist es, das erzeugte Dokument vollständig neu einzufügen.
      </Callout>

      <h2>Mehrere AWS-Konten</h2>
      <p>Zwei Möglichkeiten, ein zweites Konto abzudecken, je nachdem, was Sie trennen möchten.</p>
      <h3>Ein Provider pro Konto</h3>
      <p>
        Wiederholen Sie die Schritte 1 bis 4 im anderen Konto und benennen Sie den Provider
        entsprechend. Jedes Konto hat seinen eigenen Schlüssel; den einen zu widerrufen betrifft
        den anderen nicht. Das ist die am einfachsten nachvollziehbare Konfiguration.
      </p>
      <h3>Ein einziger Schlüssel, eine Rolle pro Konto</h3>
      <p>
        Der Benutzer bleibt in Konto A; die Rolle wird in Konto B angelegt, mit derselben
        Vertrauensrichtlinie (dem ARN des Benutzers aus Konto A). Kontoübergreifend muss der
        Benutzer zusätzlich berechtigt sein, diese Rolle anzunehmen. Hängen Sie ihm dazu diese
        Inline-Richtlinie an:
      </p>
      <CodeBlock
        title="Richtlinie des Benutzers, kontoübergreifender Fall"
        code={json(assumePolicy(PLACEHOLDER_ROLE_ARN))}
      />
      <p>
        Legen Sie anschließend einen zweiten Provider mit demselben Schlüsselpaar und dem
        Rollen-ARN aus Konto B an.
      </p>

      <h2>Varianten</h2>
      <h3>Ohne Rolle</h3>
      <p>
        Deaktivieren Sie <i>Über eine IAM-Rolle gehen</i> im Assistenten: Die
        Berechtigungsrichtlinie wird dann direkt am Benutzer eingefügt. Das ist ein Schritt
        weniger, dafür trägt der Schlüssel die Rechte selbst.
      </p>
      <h3>Ohne Schlüssel</h3>
      <p>
        Läuft local-cert in AWS oder in einem Cluster mit IRSA, aktivieren Sie{' '}
        <i>Kein Schlüssel</i>: Der Provider verwendet die Credentials des Prozesses
        (Instanzrolle, Pod-Rolle, Umgebungsvariablen). Eine anzunehmende Rolle bleibt zusätzlich
        möglich.
      </p>

      <h2>Einen Provider per Umgebungsvariablen deklarieren</h2>
      <p>
        Sollen die Credentials aus dem Deployment statt aus der Datenbank stammen – vom
        Orchestrator verwaltete Secrets, als Code beschriebene Infrastruktur –, wird ein Provider
        über Variablen deklariert. Alles ist optional: Ohne jede Variable werden die Provider
        ausschließlich über die Konsole verwaltet.
      </p>
      <CodeBlock
        title=".env"
        code={`PROVIDER_AWS_DEFAULT_NAME="Default AWS"
PROVIDER_AWS_DEFAULT_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_DEFAULT_SECRET_ACCESS_KEY=…
PROVIDER_AWS_DEFAULT_ROLE_ARN=arn:aws:iam::123456789012:role/local-cert-dns

# ein zweites Konto: derselbe Block, anderes Label
PROVIDER_AWS_PROD_NAME="aws-prod"
PROVIDER_AWS_PROD_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_PROD_SECRET_ACCESS_KEY=…`}
      />
      <ul>
        <li>
          <code>_NAME</code> deklariert den Provider; es ist die einzige Pflichtvariable des
          Blocks. Das Label (<code>DEFAULT</code>, <code>PROD</code> …) ist frei wählbar.
        </li>
        <li>
          Ohne Schlüsselpaar verwendet der Provider die Credentials des Prozesses.{' '}
          <code>_ROLE_ARN</code> und <code>_REGION</code> sind optional.
        </li>
        <li>
          Diese Provider erscheinen in der Konsole mit dem Vermerk <i>Umgebung</i>. Sie lassen sich
          testen und ihre Richtlinie kann erzeugt werden, aber sie lassen sich weder ändern noch
          entfernen: Das geschieht in den Variablen, gefolgt von einem Neustart. Ihr geheimer
          Schlüssel wird nie in die Datenbank geschrieben.
        </li>
        <li>
          Das Label <code>DEFAULT</code> hat eine Besonderheit: Domains, die vor der Einführung der
          Provider deklariert wurden, werden beim Start diesem zugeordnet.
        </li>
      </ul>

      <h2 id="nettoyage">Einen Provider entfernen und AWS aufräumen</h2>
      <p>
        <Link href="/admin/providers">Provider</Link> → <b>Entfernen</b> löscht den Provider aus
        local-cert. Aktivieren Sie <b>Auch auf AWS-Seite aufräumen</b>, macht der Provider zuerst
        rückgängig, was der Assistent Sie hat anlegen lassen:
      </p>
      <ol>
        <li>
          die Sitzung der Rolle löscht den IAM-Benutzer: seine Zugriffsschlüssel, seine
          Inline-Richtlinien und dann den Benutzer selbst;
        </li>
        <li>anschließend löscht sie die Richtlinie der Rolle selbst.</li>
      </ol>
      <p>
        IAM erlaubt einer Identität nicht, sich vollständig selbst zu löschen: Eine Rolle lässt
        sich erst löschen, wenn ihre Richtlinien entfernt sind, und aus diesen stammt das Recht
        dazu. Es bleibt also die Rolle <code>local-cert-dns</code>, ohne jegliche Rechte und von
        niemandem mehr annehmbar. Die Konsole zeigt den Befehl, um sie mit einem Administratorkonto
        zu löschen:
      </p>
      <CodeBlock title="AWS CLI" code="aws iam delete-role --role-name local-cert-dns" />
      <ul>
        <li>
          Ohne Rolle kann der Provider nur seinen eigenen Zugriffsschlüssel löschen; der Benutzer
          bleibt ohne Zugangsdaten bestehen.
        </li>
        <li>
          Die zugehörigen Rechte sind die <code>LocalCertRemove…</code>-Blöcke der erzeugten
          Richtlinie. Sie betreffen nur den Benutzer und die Rolle des Providers und erlauben
          ausschließlich das Löschen: Ein gestohlener Schlüssel könnte local-cert lahmlegen, aber
          dessen Rechte nicht erweitern. Entfernen Sie sie aus dem Dokument, wenn Sie diese Option
          nicht möchten.
        </li>
        <li>
          Ein vor dieser Option angelegter Provider muss zunächst die aktualisierte Richtlinie
          erhalten (Schaltfläche <b>Richtlinie</b>). Verweigert AWS vor jedem Löschen den Zugriff,
          bleibt der Provider erhalten.
        </li>
        <li>
          Die Option wird nicht angeboten, wenn ein anderer Provider denselben Benutzer oder
          dieselbe Rolle verwendet, und auch nicht für per Umgebungsvariablen deklarierte
          Provider.
        </li>
        <li>
          Hat der Benutzer angehängte verwaltete Richtlinien oder gehört er einer Gruppe an,
          verweigert IAM das Löschen: Das Aufräumen endet dort und listet auf, was noch zu tun
          ist.
        </li>
      </ul>

      <h2>Schlüsselrotation</h2>
      <ol>
        <li>
          Erstellen Sie in IAM einen <b>zweiten</b> Zugriffsschlüssel für den Benutzer.
        </li>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>Bearbeiten</b> →{' '}
          <i>Schlüsselpaar ersetzen</i> → <b>Testen</b>, dann <b>Speichern</b>.
        </li>
        <li>Deaktivieren Sie in IAM den alten Schlüssel und löschen Sie ihn anschließend.</li>
      </ol>
      <p>Die Rolle und ihre Richtlinie sind davon nicht betroffen.</p>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout } from '../../_lib/prose';

export default function Gcp() {
  return (
    <>
      <h1>Google-Cloud-Provider</h1>
      <p className="lead">
        local-cert steuert Cloud DNS als Dienstkonto, anhand seines JSON-Schlüssels. Ein Provider
        entspricht einem Google-Cloud-Projekt.
      </p>

      <h2>Bevor Sie beginnen</h2>
      <ul>
        <li>
          Die <b>Cloud DNS</b>-API ist im Projekt aktiviert (<b>APIs &amp; Dienste</b> →{' '}
          <b>Bibliothek</b> → Cloud DNS API).
        </li>
        <li>
          Die Zone ist <b>öffentlich</b>. Eine private Zone ist für Let&apos;s Encrypt unsichtbar.
        </li>
      </ul>

      <h2>1. Das Dienstkonto erstellen</h2>
      <ol>
        <li>
          Google-Cloud-Konsole, Projekt mit Ihren Zonen → <b>IAM &amp; Verwaltung</b> →{' '}
          <b>Dienstkonten</b> → <b>Dienstkonto erstellen</b>.
        </li>
        <li>
          <b>Name</b>: <code>local-cert-dns</code>. <b>Erstellen und fortfahren</b>.
        </li>
        <li>
          <b>Rolle</b>: <b>DNS-Administrator</b> (<code>roles/dns.admin</code>).{' '}
          <b>Weiter</b>, dann <b>Fertig</b>.
        </li>
      </ol>
      <p>Oder auf der Kommandozeile:</p>
      <CodeBlock
        title="gcloud"
        code={`PROJECT=mon-projet
gcloud iam service-accounts create local-cert-dns --project "$PROJECT"
gcloud projects add-iam-policy-binding "$PROJECT" \\
  --member "serviceAccount:local-cert-dns@$PROJECT.iam.gserviceaccount.com" \\
  --role roles/dns.admin`}
      />

      <h2>2. Den JSON-Schlüssel erstellen</h2>
      <ol>
        <li>
          Öffnen Sie das Dienstkonto → Reiter <b>Schlüssel</b> → <b>Schlüssel hinzufügen</b> →{' '}
          <b>Neuen Schlüssel erstellen</b> → <b>JSON</b>.
        </li>
        <li>Eine <code>.json</code>-Datei wird heruntergeladen: Es ist das einzige Exemplar.</li>
      </ol>
      <CodeBlock
        title="gcloud"
        code={`gcloud iam service-accounts keys create local-cert-dns.json \\
  --iam-account "local-cert-dns@$PROJECT.iam.gserviceaccount.com"`}
      />
      <Callout title="Schlüsselerstellung blockiert?">
        Manche Organisationen verbieten Dienstkonto-Schlüssel (Einschränkung{' '}
        <code>iam.disableServiceAccountKeyCreation</code>). Sie muss dann für dieses Projekt von
        einem Administrator der Organisation aufgehoben werden.
      </Callout>

      <h2>3. Den Provider anlegen</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>+ Neuer Provider</b> →{' '}
          <b>Google Cloud</b>.
        </li>
        <li>
          Vergeben Sie einen Namen und fügen Sie den <b>gesamten Inhalt</b> der JSON-Datei ein. Die
          Projekt-ID wird aus dem Schlüssel gelesen; geben Sie sie nur an, wenn die Zonen in einem
          anderen Projekt liegen.
        </li>
        <li>
          <b>Verbindung testen</b>, dann <b>Speichern</b>. Löschen Sie anschließend die
          heruntergeladene Datei.
        </li>
      </ol>

      <h2>4. Eine Domain hinzufügen</h2>
      <p>
        <Link href="/admin/domains">Domains</Link> → <b>+ Domain hinzufügen</b> → dieser Provider →
        die Zone. Der Test legt einen temporären TXT-Eintrag an und löscht ihn wieder.
      </p>

      <h2>Wissenswertes</h2>
      <ul>
        <li>
          Die Rolle <code>roles/dns.admin</code> gilt für alle Zonen des Projekts. Um eine Zone zu
          isolieren, legen Sie sie in ein eigenes Projekt oder gewähren Sie die Rolle auf Ebene der
          Zone statt des Projekts (IAM der verwalteten Zone), wobei das Konto für die Auflistung{' '}
          <code>roles/dns.reader</code> auf dem Projekt behält.
        </li>
        <li>
          Die Domain muss an die von Cloud DNS für die Zone angegebenen Nameserver delegiert sein (
          <code>ns-cloud-*.googledomains.com</code>).
        </li>
        <li>
          Mehrere Projekte: ein Provider pro Projekt, jeweils mit eigenem Dienstkonto – oder ein
          einziges Dienstkonto, dem jedes Projekt die Rolle gewährt, deklariert als so viele
          Provider mit unterschiedlichen <b>Projekt-IDs</b>.
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
                <code>invalid_grant</code>
              </td>
              <td>Schlüssel gelöscht oder Dienstkonto deaktiviert; Uhr des Servers geht falsch.</td>
            </tr>
            <tr>
              <td>
                <code>403 … Cloud DNS API has not been used</code>
              </td>
              <td>Die Cloud-DNS-API ist im Projekt nicht aktiviert.</td>
            </tr>
            <tr>
              <td>
                <code>403 Forbidden</code>
              </td>
              <td>Das Dienstkonto hat in diesem Projekt nicht die DNS-Rolle.</td>
            </tr>
            <tr>
              <td>
                <code>The service account key is not valid JSON</code>
              </td>
              <td>Die Datei wurde nur teilweise eingefügt.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { getMessages } from '@/lib/i18n/server';
import { localizeProvider } from '@/lib/i18n/provider-text';
import { PROVIDER_INFO, PROVIDER_TYPES } from '@/lib/dns/provider-types';
import { Callout } from '../../_lib/prose';

export default async function Providers() {
  const messages = await getMessages();
  return (
    <>
      <h1>DNS-Provider</h1>
      <p className="lead">
        Ein Provider ist ein Konto beim Anbieter Ihrer DNS-Zonen, samt den Zugangsdaten, mit denen
        local-cert dort schreiben darf. Darüber läuft der von Let&apos;s Encrypt geforderte
        Nachweis: ein TXT-Eintrag, der für die Dauer der Validierung gesetzt wird.
      </p>

      <h2>Unterstützte Anbieter</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Anbieter</th>
              <th>Dienst</th>
              <th>Zugangsdaten</th>
              <th>Minimale TTL</th>
              <th>Anleitung</th>
            </tr>
          </thead>
          <tbody>
            {PROVIDER_TYPES.map((type) => {
              const info = localizeProvider(messages, PROVIDER_INFO[type]);
              return (
                <tr key={type}>
                  <td>{info.label}</td>
                  <td>{info.product}</td>
                  <td>
                    {type === 'aws'
                      ? 'IAM-Schlüssel, Rolle empfohlen'
                      : info.fields
                          .filter((f) => f.required)
                          .map((f) => f.label)
                          .join(', ')}
                  </td>
                  <td>{info.minTtl} s</td>
                  <td>
                    <Link href={`/admin/docs/${info.docs}`}>öffnen</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Das Prinzip, unabhängig vom Anbieter</h2>
      <ol>
        <li>
          Sie erstellen beim Anbieter Zugangsdaten, die <b>auf DNS beschränkt</b> sind – niemals
          die Ihres Hauptkontos.
        </li>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>+ Neuer Provider</b>: Sie wählen den
          Anbieter, fügen die Zugangsdaten ein, testen und speichern.
        </li>
        <li>
          <Link href="/admin/domains">Domains</Link> → <b>+ Domain hinzufügen</b>: local-cert
          listet die Zonen des Kontos auf, Sie wählen eine aus, und es testet seine Rechte.
        </li>
      </ol>
      <p>
        Mehrere Provider desselben Anbieters sind der Normalfall: einer pro Konto oder einer pro
        Rechtebereich. Die Geheimnisse werden verschlüsselt in der Datenbank gespeichert
        (AES-256-GCM mit <code>MASTER_KEY</code>) und weder erneut angezeigt noch von der API
        zurückgegeben.
      </p>

      <h2>Was sich von Anbieter zu Anbieter unterscheidet</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>AWS Route53</th>
              <th>Die anderen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Rechte</td>
              <td>pro Zone: eine IAM-Richtlinie, die bei jeder neuen Domain fortgeschrieben wird</td>
              <td>an die Zugangsdaten gebunden: beim Hinzufügen einer Domain ist nichts zu ändern</td>
            </tr>
            <tr>
              <td>Rechtetest</td>
              <td>ohne jegliche Schreiboperation in der Zone</td>
              <td>
                ein temporärer TXT-Eintrag (<code>_localcert-preflight-…</code>) wird angelegt und
                wieder gelöscht
              </td>
            </tr>
            <tr>
              <td>Schreiboperationen</td>
              <td>atomar, bis zur Verbreitung nachverfolgt</td>
              <td>Eintrag für Eintrag</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout title="Minimale TTL">
        Gandi (300 s) und GoDaddy (600 s) lehnen kurze TTLs ab. local-cert erhöht den
        angeforderten Wert dann stillschweigend. Die Ausstellung wird dadurch nicht verhindert –
        die Validierung liest direkt von den autoritativen Servern –, aber ein geänderter{' '}
        <code>A</code>-Eintrag braucht diese Zeit, bis er überall sichtbar ist.
      </Callout>

      <h2>Kennzeichnung dessen, was local-cert anlegt</h2>
      <p>
        Jeder auf Ihre Anforderung veröffentlichte Eintrag wird von einem TXT-Eintrag{' '}
        <code>_local-cert.&lt;name&gt;</code> begleitet: So lässt sich in der Zone unterscheiden,
        was von local-cert stammt und was bereits vorher existierte. Die Variable{' '}
        <code>TAG_RECORDS=0</code> deaktiviert das.
      </p>

      <h2>Einen Provider per Umgebungsvariablen deklarieren</h2>
      <p>
        Sollen die Zugangsdaten aus dem Deployment statt aus der Datenbank stammen, wird ein
        Provider über Variablen deklariert. Das ist optional, und der Block lässt sich mit einem
        anderen Label für jedes Konto wiederholen.
      </p>
      <CodeBlock
        title=".env"
        code={`# PROVIDER_<ANBIETER>_<LABEL>_NAME deklariert den Provider; der Rest sind seine Zugangsdaten
PROVIDER_AWS_DEFAULT_NAME="Default AWS"
PROVIDER_AWS_DEFAULT_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_DEFAULT_SECRET_ACCESS_KEY=…
PROVIDER_AWS_DEFAULT_ROLE_ARN=arn:aws:iam::123456789012:role/local-cert-dns

PROVIDER_OVH_PERSO_NAME="ovh-perso"
PROVIDER_OVH_PERSO_ENDPOINT=ovh-eu
PROVIDER_OVH_PERSO_APPLICATION_KEY=…
PROVIDER_OVH_PERSO_APPLICATION_SECRET=…
PROVIDER_OVH_PERSO_CONSUMER_KEY=…

PROVIDER_GANDI_MAIN_NAME="gandi"
PROVIDER_GANDI_MAIN_TOKEN=…

PROVIDER_GODADDY_MAIN_NAME="godaddy"
PROVIDER_GODADDY_MAIN_API_KEY=…
PROVIDER_GODADDY_MAIN_API_SECRET=…

PROVIDER_GCP_MAIN_NAME="gcp"
PROVIDER_GCP_MAIN_SERVICE_ACCOUNT_JSON=<das JSON des Schlüssels oder dessen Base64-Kodierung>
PROVIDER_GCP_MAIN_PROJECT_ID=mon-projet   # optional`}
      />
      <ul>
        <li>
          Das Label (<code>DEFAULT</code>, <code>PERSO</code>, <code>MAIN</code> …) ist frei
          wählbar: Großbuchstaben, Ziffern und Unterstriche.
        </li>
        <li>
          Diese Provider erscheinen in der Konsole mit dem Vermerk <i>Umgebung</i>. Sie lassen sich
          testen, aber weder ändern noch entfernen: Das geschieht in den Variablen, gefolgt von
          einem Neustart. Ihre Geheimnisse werden nie in die Datenbank geschrieben.
        </li>
        <li>
          Eine unvollständige Deklaration wird ignoriert, mit einer Meldung beim Start, die die
          fehlende Variable nennt.
        </li>
      </ul>
    </>
  );
}

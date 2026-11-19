import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout } from '../../_lib/prose';

export default function Gcp() {
  return (
    <>
      <h1>Provider Google Cloud</h1>
      <p className="lead">
        local-cert gestisce Cloud DNS come service account, a partire dalla sua chiave JSON. Un
        provider corrisponde a un progetto Google Cloud.
      </p>

      <h2>Prima di iniziare</h2>
      <ul>
        <li>
          L&apos;API <b>Cloud DNS</b> è abilitata sul progetto (<b>API e servizi</b> →{' '}
          <b>Libreria</b> → Cloud DNS API).
        </li>
        <li>
          La zona è <b>pubblica</b>. Una zona privata è invisibile a Let&apos;s Encrypt.
        </li>
      </ul>

      <h2>1. Creare il service account</h2>
      <ol>
        <li>
          Console Google Cloud, progetto che contiene le zone → <b>IAM e amministrazione</b> →{' '}
          <b>Service account</b> → <b>Crea service account</b>.
        </li>
        <li>
          <b>Nome</b>: <code>local-cert-dns</code>. <b>Crea e continua</b>.
        </li>
        <li>
          <b>Ruolo</b>: <b>Amministratore DNS</b> (<code>roles/dns.admin</code>).{' '}
          <b>Continua</b>, quindi <b>Fine</b>.
        </li>
      </ol>
      <p>Oppure da riga di comando:</p>
      <CodeBlock
        title="gcloud"
        code={`PROJECT=mio-progetto
gcloud iam service-accounts create local-cert-dns --project "$PROJECT"
gcloud projects add-iam-policy-binding "$PROJECT" \\
  --member "serviceAccount:local-cert-dns@$PROJECT.iam.gserviceaccount.com" \\
  --role roles/dns.admin`}
      />

      <h2>2. Creare la chiave JSON</h2>
      <ol>
        <li>
          Aprire il service account → scheda <b>Chiavi</b> → <b>Aggiungi chiave</b> →{' '}
          <b>Crea nuova chiave</b> → <b>JSON</b>.
        </li>
        <li>Viene scaricato un file <code>.json</code>: è l&apos;unico esemplare.</li>
      </ol>
      <CodeBlock
        title="gcloud"
        code={`gcloud iam service-accounts keys create local-cert-dns.json \\
  --iam-account "local-cert-dns@$PROJECT.iam.gserviceaccount.com"`}
      />
      <Callout title="Creazione delle chiavi bloccata?">
        Alcune organizzazioni vietano le chiavi dei service account (vincolo{' '}
        <code>iam.disableServiceAccountKeyCreation</code>). Occorre allora farlo rimuovere per
        questo progetto da un amministratore dell&apos;organizzazione.
      </Callout>

      <h2>3. Creare il provider</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>+ nuovo provider</b> →{' '}
          <b>Google Cloud</b>.
        </li>
        <li>
          Assegnare un nome e incollare <b>l&apos;intero contenuto</b> del file JSON. L&apos;ID del
          progetto viene letto dalla chiave; indicarlo solo se le zone si trovano in un altro
          progetto.
        </li>
        <li>
          <b>Testa la connessione</b>, quindi <b>Salva</b>. Eliminare poi il file scaricato.
        </li>
      </ol>

      <h2>4. Aggiungere un dominio</h2>
      <p>
        <Link href="/admin/domains">Domini</Link> → <b>+ aggiungere un dominio</b> → questo
        provider → la zona. Il test crea e poi elimina un record TXT temporaneo.
      </p>

      <h2>Da sapere</h2>
      <ul>
        <li>
          Il ruolo <code>roles/dns.admin</code> riguarda tutte le zone del progetto. Per isolare
          una zona, collocarla in un progetto dedicato, oppure concedere il ruolo a livello di
          zona anziché di progetto (IAM della zona gestita) mantenendo per il service account{' '}
          <code>roles/dns.reader</code> sul progetto per l&apos;elenco.
        </li>
        <li>
          Il dominio deve essere delegato ai name server indicati da Cloud DNS per la zona (
          <code>ns-cloud-*.googledomains.com</code>).
        </li>
        <li>
          Più progetti: un provider per progetto, ciascuno con il proprio service account — oppure
          un unico service account a cui ogni progetto concede il ruolo, dichiarato come altrettanti
          provider con <b>ID progetto</b> diversi.
        </li>
      </ul>

      <h2>Risoluzione dei problemi</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Messaggio</th>
              <th>Causa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>invalid_grant</code>
              </td>
              <td>
                Chiave eliminata o service account disattivato; orologio del server non
                sincronizzato.
              </td>
            </tr>
            <tr>
              <td>
                <code>403 … Cloud DNS API has not been used</code>
              </td>
              <td>L&apos;API Cloud DNS non è abilitata sul progetto.</td>
            </tr>
            <tr>
              <td>
                <code>403 Forbidden</code>
              </td>
              <td>Il service account non ha il ruolo DNS su questo progetto.</td>
            </tr>
            <tr>
              <td>
                <code>The service account key is not valid JSON</code>
              </td>
              <td>Il file è stato incollato solo in parte.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

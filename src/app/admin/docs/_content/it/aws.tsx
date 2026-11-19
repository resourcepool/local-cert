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
      <h1>Provider AWS</h1>
      <p className="lead">
        Un provider è un&apos;identità su un account AWS, che local-cert usa per leggere e
        scrivere in Route53. Se ne crea uno per account — <code>aws-prod</code>,{' '}
        <code>aws-lab</code> — e vi si dichiarano sopra i propri domini.
      </p>

      <h2>Il modello</h2>
      <p>Tre oggetti lato AWS, ciascuno con un ruolo preciso:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Oggetto</th>
              <th>Ruolo</th>
              <th>Cosa contiene</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Utente IAM</td>
              <td>l&apos;identità di local-cert</td>
              <td>una coppia di chiavi, e nient&apos;altro</td>
            </tr>
            <tr>
              <td>Ruolo IAM</td>
              <td>ciò che local-cert ha il diritto di fare</td>
              <td>la policy Route53, che viene aggiornata nel tempo</td>
            </tr>
            <tr>
              <td>Policy del ruolo</td>
              <td>l&apos;elenco delle zone autorizzate</td>
              <td>generata da local-cert, incollata dall&apos;utente</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        La chiave memorizzata in local-cert non concede quindi alcun permesso di per sé: serve
        soltanto ad assumere il ruolo. Aggiungere una zona significa modificare la policy del
        ruolo; la chiave non cambia mai.
      </p>
      <p>
        La procedura guidata della pagina <Link href="/admin/providers">Provider</Link> percorre
        questi passaggi e genera ogni documento con le credenziali reali. Questa guida li
        descrive nel dettaglio.
      </p>

      <h2>1. Creare l&apos;utente IAM</h2>
      <ol>
        <li>
          Console AWS → <b>IAM</b> → <b>Users</b> → <b>Create user</b>.
        </li>
        <li>
          Nome: <code>local-cert</code>. Lasciare deselezionata l&apos;opzione{' '}
          <i>Provide user access to the AWS Management Console</i>.
        </li>
        <li>
          Passaggio dei permessi: <b>non associare nulla</b>. Completare la creazione.
        </li>
        <li>
          Aprire l&apos;utente → <b>Security credentials</b> → <b>Create access key</b> → caso
          d&apos;uso <i>Application running outside AWS</i>.
        </li>
        <li>
          Annotare l&apos;<b>Access key ID</b> e la <b>Secret access key</b>: quest&apos;ultima non
          è più consultabile in seguito.
        </li>
      </ol>

      <h2>2. Inserire la chiave in local-cert</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>+ nuovo provider</b>.
        </li>
        <li>
          Assegnare un nome (<code>aws-prod</code>) e incollare la coppia di chiavi.
        </li>
        <li>
          <b>Verifica la chiave</b>: local-cert chiama <code>sts:GetCallerIdentity</code>, che non
          richiede alcun permesso, e mostra l&apos;ARN dell&apos;utente. È questo ARN che serve
          a generare i passaggi successivi.
        </li>
      </ol>
      <p>
        La chiave segreta è cifrata nel database (AES-256-GCM con <code>MASTER_KEY</code>) e non
        viene mai mostrata di nuovo né restituita dall&apos;API.
      </p>

      <h2>3. Creare il ruolo</h2>
      <ol>
        <li>
          <b>IAM</b> → <b>Roles</b> → <b>Create role</b> → <b>Custom trust policy</b>.
        </li>
        <li>
          Incollare la <b>policy di trust</b> mostrata dalla procedura guidata. Autorizza solo
          l&apos;utente creato ad assumere il ruolo:
        </li>
      </ol>
      <CodeBlock title="Policy di trust (esempio)" code={json(trustPolicy(PLACEHOLDER_USER_ARN))} />
      <ol start={3}>
        <li>
          Passaggio dei permessi: non aggiungere alcuna policy gestita.
        </li>
        <li>
          Nome del ruolo: <code>local-cert-dns</code>. Crearlo.
        </li>
        <li>
          Aprire il ruolo → <b>Permissions</b> → <b>Add permissions</b> →{' '}
          <b>Create inline policy</b> → scheda <b>JSON</b>, e incollare la{' '}
          <b>policy dei permessi</b> della procedura guidata. A questo stadio contiene solo
          quanto serve per elencare le zone:
        </li>
      </ol>
      <CodeBlock title="Policy dei permessi iniziale" code={json(permissionsPolicy([], EXAMPLE))} />
      <ol start={6}>
        <li>
          Assegnare un nome alla policy (<code>local-cert-route53</code>), salvare, quindi copiare
          l&apos;<b>ARN del ruolo</b> nella procedura guidata.
        </li>
      </ol>

      <h2>4. Testare e salvare</h2>
      <p>
        <b>Testa la connessione</b> esegue di seguito tre verifiche, ciascuna dipendente dalla
        precedente:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Verifica</th>
              <th>In caso di errore</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Coppia di chiavi</td>
              <td>chiave sconosciuta, disattivata o copiata male</td>
            </tr>
            <tr>
              <td>Ruolo (AssumeRole)</td>
              <td>
                ARN del ruolo errato, oppure policy di trust che non indica l&apos;utente corretto
              </td>
            </tr>
            <tr>
              <td>Zone (ListHostedZones)</td>
              <td>policy dei permessi assente dal ruolo, o non ancora propagata</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        IAM applica una modifica in pochi secondi: un test lanciato subito dopo un incolla può
        fallire una volta. Quando le tre righe sono su <code>OK</code>, <b>Salva</b>.
      </p>

      <h2>5. Aggiungere i domini</h2>
      <p>
        Il provider ora sa elencare le zone, ma non ha ancora il permesso di scrivere in nessuna
        di esse. Questi permessi si aggiungono zona per zona:{' '}
        <Link href="/admin/docs/domains">Aggiungere un dominio</Link>. Dopo aver dichiarato
        alcune zone, la policy del ruolo appare così:
      </p>
      <CodeBlock
        title="Policy dei permessi con due zone (esempio)"
        code={json(permissionsPolicy(['Z0123456ABCDEFGHIJK', 'Z0987654ZYXWVUTSRQP'], EXAMPLE))}
      />
      <p>
        Il pulsante <b>policy</b> di ogni provider rigenera questo documento in qualsiasi
        momento a partire dai domini effettivamente dichiarati.
      </p>

      <h2>Cosa autorizza la policy</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Azione</th>
              <th>Ambito</th>
              <th>Perché</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ListHostedZones</code>
              </td>
              <td>account</td>
              <td>proporre l&apos;elenco delle zone; AWS non consente di restringerlo</td>
            </tr>
            <tr>
              <td>
                <code>GetChange</code>
              </td>
              <td>account</td>
              <td>attendere che una scrittura sia propagata</td>
            </tr>
            <tr>
              <td>
                <code>GetHostedZone</code>, <code>ListResourceRecordSets</code>
              </td>
              <td>zone dichiarate</td>
              <td>
                conoscere i name server da interrogare, elencare i record
              </td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code>
              </td>
              <td>zone dichiarate, tipi TXT / A / AAAA, azioni UPSERT / DELETE</td>
              <td>
                scrivere il TXT di convalida; pubblicare l&apos;indirizzo di un host se richiesto
              </td>
            </tr>
            <tr>
              <td>
                <code>iam:ListAccessKeys</code>, <code>DeleteAccessKey</code>,{' '}
                <code>ListUserPolicies</code>, <code>DeleteUserPolicy</code>,{' '}
                <code>DeleteUser</code>
              </td>
              <td>l&apos;utente IAM del provider, esclusivamente lui</td>
              <td>
                facoltativo: eliminarlo quando si rimuove il provider (
                <a href="#nettoyage">pulizia</a>)
              </td>
            </tr>
            <tr>
              <td>
                <code>iam:ListRolePolicies</code>, <code>DeleteRolePolicy</code>
              </td>
              <td>il ruolo del provider, esclusivamente lui</td>
              <td>facoltativo: svuotare il ruolo quando si rimuove il provider</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout kind="warn" title="Se si modifica la policy a mano">
        Due errori producono un <code>AccessDenied</code> di difficile lettura: rimuovere{' '}
        <code>TXT</code> dai tipi autorizzati (nessuna emissione sarà più possibile) e scrivere
        due blocchi <code>Condition</code> con lo stesso operatore (il JSON conserva solo
        l&apos;ultimo). La soluzione più sicura è incollare di nuovo l&apos;intero documento
        generato.
      </Callout>

      <h2>Più account AWS</h2>
      <p>Due modi per coprire un secondo account, a seconda di ciò che si vuole isolare.</p>
      <h3>Un provider per account</h3>
      <p>
        Ripetere i passaggi da 1 a 4 nell&apos;altro account e assegnare al provider un nome
        adeguato. Ogni account ha la propria chiave; revocarne una non intacca l&apos;altra. È
        la configurazione più semplice da gestire.
      </p>
      <h3>Una sola chiave, un ruolo per account</h3>
      <p>
        L&apos;utente resta nell&apos;account A; il ruolo viene creato nell&apos;account B, con la
        stessa policy di trust (l&apos;ARN dell&apos;utente dell&apos;account A). Tra account
        diversi, l&apos;utente deve inoltre essere autorizzato ad assumere quel ruolo. Associargli
        questa policy inline:
      </p>
      <CodeBlock
        title="Policy dell'utente, caso cross-account"
        code={json(assumePolicy(PLACEHOLDER_ROLE_ARN))}
      />
      <p>
        Creare poi un secondo provider con la stessa coppia di chiavi e l&apos;ARN del ruolo
        dell&apos;account B.
      </p>

      <h2>Varianti</h2>
      <h3>Senza ruolo</h3>
      <p>
        Deselezionare <i>Usa un ruolo IAM</i> nella procedura guidata: la policy dei
        permessi si incolla allora direttamente sull&apos;utente. È un passaggio in meno, a
        prezzo di una chiave che porta essa stessa i permessi.
      </p>
      <h3>Senza chiave</h3>
      <p>
        Se local-cert gira in AWS o in un cluster con IRSA, selezionare <i>Nessuna chiave</i>: il
        provider usa le credenziali del processo (ruolo dell&apos;istanza, ruolo del pod, variabili
        d&apos;ambiente). Resta possibile assumere un ruolo in aggiunta.
      </p>

      <h2>Dichiarare un provider tramite variabili d&apos;ambiente</h2>
      <p>
        Quando le credenziali devono provenire dal deployment anziché dal database — segreti
        gestiti dall&apos;orchestratore, infrastruttura descritta come codice — un provider si
        dichiara tramite variabili. Tutto è facoltativo: senza alcuna variabile, i provider si
        gestiscono esclusivamente dalla console.
      </p>
      <CodeBlock
        title=".env"
        code={`PROVIDER_AWS_DEFAULT_NAME="Default AWS"
PROVIDER_AWS_DEFAULT_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_DEFAULT_SECRET_ACCESS_KEY=…
PROVIDER_AWS_DEFAULT_ROLE_ARN=arn:aws:iam::123456789012:role/local-cert-dns

# un secondo account: stesso blocco, altra etichetta
PROVIDER_AWS_PROD_NAME="aws-prod"
PROVIDER_AWS_PROD_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_PROD_SECRET_ACCESS_KEY=…`}
      />
      <ul>
        <li>
          <code>_NAME</code> dichiara il provider; è l&apos;unica variabile obbligatoria del
          blocco. L&apos;etichetta (<code>DEFAULT</code>, <code>PROD</code>…) è libera.
        </li>
        <li>
          Senza coppia di chiavi, il provider usa le credenziali del processo.{' '}
          <code>_ROLE_ARN</code> e <code>_REGION</code> sono facoltativi.
        </li>
        <li>
          Questi provider compaiono nella console con la dicitura <i>ambiente</i>. Si possono
          testare e se ne può generare la policy, ma non modificarli né rimuoverli: ciò avviene
          nelle variabili, seguito da un riavvio. La loro chiave segreta non viene mai scritta nel
          database.
        </li>
        <li>
          L&apos;etichetta <code>DEFAULT</code> ha una particolarità: i domini dichiarati prima
          dell&apos;introduzione dei provider vi vengono associati all&apos;avvio.
        </li>
      </ul>

      <h2 id="nettoyage">Rimuovere un provider e ripulire AWS</h2>
      <p>
        <Link href="/admin/providers">Provider</Link> → <b>rimuovi</b> elimina il provider da
        local-cert. Selezionando <b>Ripulisci anche lato AWS</b>, il provider annulla prima ciò
        che la procedura guidata ha fatto creare:
      </p>
      <ol>
        <li>
          la sessione del ruolo elimina l&apos;utente IAM: le sue chiavi di accesso, le sue policy
          inline, quindi l&apos;utente;
        </li>
        <li>elimina poi la policy del ruolo stesso.</li>
      </ol>
      <p>
        IAM non consente a un&apos;identità di eliminarsi del tutto: un ruolo può essere eliminato
        solo dopo che le sue policy sono state rimosse, e il diritto di farlo deriva proprio da
        quelle. Resta quindi il ruolo <code>local-cert-dns</code>, privo di permessi e che nessuno
        può più assumere. La console mostra il comando per eliminarlo con un account
        amministratore:
      </p>
      <CodeBlock title="AWS CLI" code="aws iam delete-role --role-name local-cert-dns" />
      <ul>
        <li>
          Senza ruolo, il provider può solo eliminare la propria chiave di accesso; l&apos;utente
          resta, privo di credenziali.
        </li>
        <li>
          I permessi corrispondenti sono i blocchi <code>LocalCertRemove…</code> della policy
          generata. Riguardano solo l&apos;utente e il ruolo del provider e consentono solo di
          eliminare: una chiave rubata potrebbe interrompere local-cert, non estenderne i
          permessi. Rimuoverli dal documento se non si desidera questa opzione.
        </li>
        <li>
          Un provider creato prima di questa opzione deve prima ricevere la policy aggiornata
          (pulsante <b>policy</b>). Se AWS rifiuta prima di qualsiasi eliminazione, il provider
          viene conservato.
        </li>
        <li>
          L&apos;opzione non viene proposta quando un altro provider usa lo stesso utente o lo
          stesso ruolo, né per i provider dichiarati tramite variabili d&apos;ambiente.
        </li>
        <li>
          Se l&apos;utente ha policy gestite associate o appartiene a un gruppo, IAM rifiuta di
          eliminarlo: la pulizia si ferma lì ed elenca ciò che resta da fare.
        </li>
      </ul>

      <h2>Rotazione della chiave</h2>
      <ol>
        <li>
          In IAM, creare una <b>seconda</b> chiave di accesso sull&apos;utente.
        </li>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>modifica</b> →{' '}
          <i>Sostituisci la coppia di chiavi</i> → <b>Testa</b>, quindi <b>Salva</b>.
        </li>
        <li>In IAM, disattivare la vecchia chiave, quindi eliminarla.</li>
      </ol>
      <p>Il ruolo e la sua policy non sono interessati.</p>
    </>
  );
}

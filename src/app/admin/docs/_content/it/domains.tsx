import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function Domains() {
  return (
    <>
      <h1>Aggiungere un dominio</h1>
      <p className="lead">
        Un dominio gestito è un nome di base — <code>home.example.com</code> — sotto il quale
        local-cert ha il diritto di emettere certificati. Si appoggia a una zona ospitata di un
        provider. La procedura guidata della pagina <Link href="/admin/domains">Domini</Link>{' '}
        svolge tutto in tre schermate.
      </p>

      <h2>Prima di iniziare</h2>
      <ul>
        <li>
          Un <Link href="/admin/docs/providers">provider</Link> registrato, il cui test risulti
          verde.
        </li>
        <li>
          Una zona <b>pubblica</b> presso questo fornitore, che sia autorevole per il nome.
          Let&apos;s Encrypt deve poter leggere il record di convalida da Internet: una zona
          privata non è adatta, anche se gli host restano privati.
        </li>
      </ul>
      <Callout title="Dedicare una zona alla LAN">
        Non è necessario esporre la zona principale. Si crea una zona Route53 per{' '}
        <code>home.example.com</code> e la si delega da <code>example.com</code> con quattro
        record <code>NS</code>: local-cert avrà permessi solo su questo sottodominio, qualunque
        sia il fornitore della zona padre.
      </Callout>

      <h2>1. Scegliere il provider</h2>
      <p>
        <b>+ aggiungere un dominio</b>, quindi selezionare il provider. local-cert interroga
        l&apos;account e mostra il numero di zone visibili.
      </p>

      <h2>2. Scegliere la zona</h2>
      <p>
        Le zone dell&apos;account sono elencate con il rispettivo identificatore. Una zona privata
        appare in grigio. Se una zona ha già un dominio gestito, viene indicato.
      </p>
      <ul>
        <li>
          <b>Nome di base</b>: per impostazione predefinita, il nome della zona. È possibile
          restringerlo a un sottodominio (<code>lab.home.example.com</code> nella zona{' '}
          <code>home.example.com</code>): solo i nomi sottostanti potranno ricevere un
          certificato.
        </li>
        <li>
          <b>TTL predefinito</b>: durata dei record pubblicati da local-cert. 60 secondi vanno
          bene.
        </li>
      </ul>

      <h2>3. Concedere i permessi, testare, aggiungere</h2>
      <p>
        local-cert verifica subito i propri permessi sulla zona. Se sono già presenti, resta solo
        da confermare. In caso contrario la schermata indica cosa fare:
      </p>
      <ol>
        <li>
          Nella console AWS, aprire il ruolo (o l&apos;utente) indicato → scheda{' '}
          <b>Permissions</b>.
        </li>
        <li>
          Fare clic sulla policy <b>già esistente</b>, <code>local-cert-route53</code> — quella
          creata insieme al provider — poi su <b>Edit</b> → scheda <b>JSON</b>. Non aggiungere una
          seconda policy: è questa che va aggiornata.
        </li>
        <li>
          Sostituire l&apos;intero contenuto con il documento mostrato, quindi <b>Next</b> →{' '}
          <b>Save changes</b>. Il documento contiene le zone già dichiarate su questo provider{' '}
          <b>più</b> quella nuova: non viene rimosso nulla.
        </li>
        <li>
          Tornare nella procedura guidata e fare clic su <b>Ripeti il test</b>.
        </li>
        <li>
          Quando tutte le righe richieste sono su <code>OK</code>, fare clic su{' '}
          <b>Aggiungi il dominio</b>.
        </li>
      </ol>

      <h3>Aggiungere senza attendere: lo stato «in attesa»</h3>
      <p>
        Un fornitore può impiegare alcuni minuti ad applicare una modifica dei permessi. Invece di
        ripetere il test a mano, si può aggiungere il dominio mentre il test fallisce ancora
        (pulsante <b>Aggiungi in attesa</b>):
      </p>
      <ul>
        <li>
          il dominio è <b>in attesa</b> (<code>pending</code>): local-cert ripete il test ogni
          minuto, per cinque volte, e lo imposta come <b>attivo</b> (<code>active</code>) non
          appena riesce;
        </li>
        <li>
          dopo cinque insuccessi passa in <b>errore</b> (<code>error</code>), con l&apos;ultimo
          rifiuto visualizzato. Dopo aver corretto i permessi, fare clic su{' '}
          <b>riavvia la verifica</b>: inizia un nuovo ciclo;
        </li>
        <li>
          finché non è attivo, il dominio non riceve né certificati né record: l&apos;API risponde{' '}
          <code>409</code> e il server ACME <code>rejectedIdentifier</code>.
        </li>
      </ul>

      <Callout title="Fuori da AWS, questo passaggio è più breve">
        Con OVHcloud, Gandi, GoDaddy e Google Cloud, i permessi sono legati alle credenziali del
        provider: non c&apos;è nessuna policy da incollare, solo il test. Quest&apos;ultimo crea e
        poi elimina un record TXT temporaneo nella zona. I passaggi sopra e la tabella qui sotto
        descrivono il caso AWS.
      </Callout>

      <h3>Cosa verifica il test</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Chiamata</th>
              <th>Richiesta</th>
              <th>Serve a</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ListResourceRecordSets</code>
              </td>
              <td>sì</td>
              <td>leggere la zona e verificare che copra il nome di base</td>
            </tr>
            <tr>
              <td>
                <code>GetHostedZone</code>
              </td>
              <td>sì</td>
              <td>individuare i name server da interrogare durante la convalida</td>
            </tr>
            <tr>
              <td>
                <code>GetChange</code>
              </td>
              <td>sì</td>
              <td>attendere la propagazione di una scrittura</td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code> (TXT)
              </td>
              <td>sì</td>
              <td>scrivere il record di convalida</td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code> (A)
              </td>
              <td>no</td>
              <td>pubblicare l&apos;indirizzo di un host, se richiesto all&apos;emissione</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Il permesso di scrittura viene sondato eliminando un record che non esiste: AWS verifica
        l&apos;autorizzazione prima di constatare che non c&apos;è nulla da eliminare.{' '}
        <b>Il test non modifica mai la zona.</b>
      </p>

      <h3>Se il test resta rosso</h3>
      <ul>
        <li>
          Attendere qualche secondo e ripetere il test: IAM non propaga le modifiche
          istantaneamente.
        </li>
        <li>
          Verificare che la policy sia stata incollata sull&apos;identità indicata, e non
          sull&apos;utente quando il provider usa un ruolo.
        </li>
        <li>
          Se tutte le righe falliscono con lo stesso messaggio, il problema è il provider stesso:
          pulsante <b>testa</b> in <Link href="/admin/providers">Provider</Link>.
        </li>
        <li>
          Se sulla zona esiste un record <code>CAA</code>, deve autorizzare{' '}
          <code>letsencrypt.org</code>: il test non lo verifica, ma l&apos;emissione fallirà.
        </li>
      </ul>
      <p>
        <b>Aggiungi comunque</b> registra un dominio il cui test fallisce. Utile per preparare una
        configurazione; nessuna emissione andrà a buon fine finché mancano i permessi.
      </p>

      <h2>Dopo</h2>
      <ul>
        <li>
          Concedere l&apos;accesso al dominio in <Link href="/admin/keys">Chiavi e permessi</Link>:
          una chiave API con i relativi permessi, oppure una credenziale EAB per un client ACME.
        </li>
        <li>
          Emettere un primo certificato: <Link href="/admin/docs">Avvio rapido</Link>.
        </li>
      </ul>

      <h2>Rimuovere un dominio</h2>
      <p>
        <b>rimuovi</b> viene rifiutato finché esistono certificati. <b>forza</b> li revoca, pulisce
        la zona per quanto possibile, poi elimina tutto. Occorre quindi rigenerare la policy del
        provider (pulsante <b>policy</b>) e incollarla di nuovo in AWS: la zona rimossa non vi
        compare più.
      </p>
    </>
  );
}

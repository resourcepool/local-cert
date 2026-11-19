import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function GoDaddy() {
  return (
    <>
      <h1>Provider GoDaddy</h1>
      <p className="lead">
        local-cert gestisce il DNS di GoDaddy con una chiave API di produzione. Verificare prima
        di tutto che il proprio account ne abbia diritto: GoDaddy non la rende disponibile a
        tutti.
      </p>

      <Callout kind="warn" title="Condizione di accesso all'API">
        GoDaddy riserva le proprie API di gestione dei domini e del DNS agli account che
        possiedono almeno dieci domini, oppure un abbonamento Discount Domain Club. Al di sotto,
        la chiave si crea normalmente ma ogni chiamata risponde <code>403 ACCESS_DENIED</code>. In
        questo caso, la soluzione duratura è delegare il sottodominio interessato a un fornitore
        DNS supportato — vedere in fondo alla pagina.
      </Callout>

      <h2>1. Creare la chiave</h2>
      <ol>
        <li>
          Aprire <code>https://developer.godaddy.com/keys</code>, dopo aver effettuato l&apos;accesso
          con l&apos;account che possiede i domini.
        </li>
        <li>
          <b>Create New API Key</b>. Nome: <code>local-cert</code>. Ambiente: <b>Production</b>{' '}
          (una chiave <i>OTE</i> non vede i domini reali).
        </li>
        <li>
          Copiare la <b>Key</b> e il <b>Secret</b>: il secret viene mostrato una sola volta.
        </li>
      </ol>
      <p>
        Una chiave GoDaddy dà accesso all&apos;intero account: non esistono restrizioni per
        dominio né per tipo di operazione.
      </p>

      <h2>2. Creare il provider</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>+ nuovo provider</b> →{' '}
          <b>GoDaddy</b>.
        </li>
        <li>Assegnare un nome, incollare la chiave e il secret.</li>
        <li>
          <b>Testa la connessione</b>, quindi <b>Salva</b>.
        </li>
      </ol>

      <h2>3. Aggiungere un dominio</h2>
      <p>
        <Link href="/admin/domains">Domini</Link> → <b>+ aggiungere un dominio</b> → questo
        provider → il dominio. Il test crea e poi elimina un record TXT temporaneo.
      </p>

      <h2>Da sapere</h2>
      <ul>
        <li>
          Il dominio deve usare i name server di GoDaddy (<code>ns*.domaincontrol.com</code>).
        </li>
        <li>
          <b>TTL minimo: 600 secondi.</b> local-cert aumenta qualsiasi valore inferiore. Nessun
          effetto sull&apos;emissione dei certificati.
        </li>
      </ul>

      <h2>Se il proprio account non ha accesso all&apos;API</h2>
      <p>
        Mantenere il dominio presso GoDaddy e delegare solo il sottodominio della rete locale a un
        fornitore che local-cert sa gestire:
      </p>
      <ol>
        <li>
          Creare una zona <code>home.example.com</code> presso AWS Route53, OVHcloud, Gandi o
          Google Cloud DNS.
        </li>
        <li>
          Nel DNS GoDaddy di <code>example.com</code>, aggiungere un record <code>NS</code> per
          ciascun name server di questa zona, con nome <code>home</code>.
        </li>
        <li>Dichiarare il provider corrispondente e aggiungere il dominio delegato.</li>
      </ol>

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
                <code>401 UNABLE_TO_AUTHENTICATE</code>
              </td>
              <td>Chiave o secret errati, oppure chiave OTE usata in produzione.</td>
            </tr>
            <tr>
              <td>
                <code>403 ACCESS_DENIED</code>
              </td>
              <td>L&apos;account non soddisfa la condizione di accesso all&apos;API.</td>
            </tr>
            <tr>
              <td>
                <code>422</code> in scrittura
              </td>
              <td>Valore rifiutato da GoDaddy (TTL, formato): il messaggio indica il campo.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

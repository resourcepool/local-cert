import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function Gandi() {
  return (
    <>
      <h1>Provider Gandi</h1>
      <p className="lead">
        local-cert gestisce Gandi LiveDNS con un Personal Access Token, da limitare ai domini e ai
        permessi strettamente necessari.
      </p>

      <h2>1. Creare il token</h2>
      <ol>
        <li>
          In Gandi: <b>Organizzazioni</b> → l&apos;organizzazione proprietaria dei domini →{' '}
          <b>Condivisione</b> → <b>Personal Access Tokens</b> → <b>Crea un token</b>. Indirizzo
          diretto: <code>https://admin.gandi.net/organizations/account/pat</code>.
        </li>
        <li>
          <b>Nome</b>: <code>local-cert</code>. <b>Scadenza</b>: la più lunga accettabile — alla
          scadenza, emissioni e rinnovi si interrompono.
        </li>
        <li>
          <b>Risorse</b>: limitare ai domini che local-cert deve gestire.
        </li>
        <li>
          <b>Permessi</b>: selezionare <b>Gestire la configurazione tecnica dei domini</b>. I
          permessi di lettura associati si selezionano da soli.
        </li>
        <li>
          <b>Crea</b>, quindi copiare il token: viene mostrato una sola volta.
        </li>
      </ol>
      <Callout kind="warn" title="Non la vecchia chiave API">
        Le vecchie «chiavi API» di Gandi (header <code>Apikey</code>) sono deprecate e non sono
        supportate: serve un Personal Access Token.
      </Callout>

      <h2>2. Creare il provider</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>+ nuovo provider</b> → <b>Gandi</b>.
        </li>
        <li>Assegnare un nome e incollare il token.</li>
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
          Il dominio deve usare <b>LiveDNS</b> (server <code>ns-*.gandi.net</code>). Un dominio
          registrato presso Gandi ma servito da name server esterni non compare nell&apos;elenco.
        </li>
        <li>
          <b>TTL minimo: 300 secondi.</b> local-cert aumenta qualsiasi valore inferiore. Nessun
          effetto sull&apos;emissione dei certificati.
        </li>
        <li>
          Per cambiare token in prossimità della scadenza:{' '}
          <Link href="/admin/providers">Provider</Link> → <b>modifica</b>, incollare il nuovo,{' '}
          <b>Testa</b>, <b>Salva</b>.
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
                <code>401</code>
              </td>
              <td>Token copiato male, scaduto o eliminato.</td>
            </tr>
            <tr>
              <td>
                <code>403</code>
              </td>
              <td>
                Il token non ha il permesso di configurazione tecnica, oppure il dominio non
                rientra nelle sue risorse.
              </td>
            </tr>
            <tr>
              <td>L&apos;elenco delle zone è vuoto</td>
              <td>Nessun dominio nel perimetro del token usa LiveDNS.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout } from '../../_lib/prose';

const RIGHTS = `GET    /domain/zone
GET    /domain/zone/*
POST   /domain/zone/*
PUT    /domain/zone/*
DELETE /domain/zone/*`;

export default function Ovh() {
  return (
    <>
      <h1>Provider OVHcloud</h1>
      <p className="lead">
        local-cert gestisce le zone DNS OVHcloud tramite l&apos;API di OVH, con un set di tre
        chiavi limitato al DNS.
      </p>

      <h2>1. Creare il token</h2>
      <p>
        OVH mette a disposizione una pagina che crea le tre chiavi in un colpo solo. Aprire
        quella della propria regione dopo aver effettuato l&apos;accesso al proprio account:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Pagina di creazione</th>
              <th>Valore di «Regione dell&apos;API»</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Europa</td>
              <td>
                <code>https://eu.api.ovh.com/createToken/</code>
              </td>
              <td>
                <code>ovh-eu</code>
              </td>
            </tr>
            <tr>
              <td>Canada</td>
              <td>
                <code>https://ca.api.ovh.com/createToken/</code>
              </td>
              <td>
                <code>ovh-ca</code>
              </td>
            </tr>
            <tr>
              <td>Stati Uniti</td>
              <td>
                <code>https://api.us.ovhcloud.com/createToken/</code>
              </td>
              <td>
                <code>ovh-us</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ol>
        <li>
          <b>Application name</b>: <code>local-cert</code>. Descrizione libera.
        </li>
        <li>
          <b>Validity</b>: <b>Unlimited</b>. Un token a durata limitata smetterebbe di funzionare
          senza preavviso, rinnovi compresi.
        </li>
        <li>
          <b>Rights</b>: aggiungere queste cinque righe (il link proposto dalla procedura guidata
          di local-cert le precompila):
        </li>
      </ol>
      <CodeBlock title="Permessi da concedere" code={RIGHTS} />
      <ol start={4}>
        <li>
          <b>Create keys</b>. La pagina mostra l&apos;<b>Application Key</b>, l&apos;
          <b>Application Secret</b> e la <b>Consumer Key</b>: annotarle tutte e tre.
        </li>
      </ol>
      <Callout title="Limitare a una sola zona">
        Per consentire l&apos;accesso a un solo dominio, sostituire <code>*</code> con il suo nome
        nei permessi: <code>/domain/zone/example.com</code> e{' '}
        <code>/domain/zone/example.com/*</code>. Mantenere <code>GET /domain/zone</code>, che
        serve a elencare le zone.
      </Callout>

      <h2>2. Creare il provider</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>+ nuovo provider</b> →{' '}
          <b>OVHcloud</b>.
        </li>
        <li>Scegliere la regione, assegnare un nome, incollare le tre chiavi.</li>
        <li>
          <b>Testa la connessione</b>: local-cert elenca le zone. Poi <b>Salva</b>.
        </li>
      </ol>

      <h2>3. Aggiungere un dominio</h2>
      <p>
        <Link href="/admin/domains">Domini</Link> → <b>+ aggiungere un dominio</b> → questo
        provider → la zona. Il test crea e poi elimina un record TXT temporaneo. Nessuna
        impostazione aggiuntiva lato OVH: i permessi sono quelli del token.
      </p>

      <h2>Da sapere</h2>
      <ul>
        <li>
          Il dominio deve usare i <b>server DNS di OVH</b> (zona DNS attiva nell&apos;area
          clienti). Se i suoi name server puntano altrove, è quell&apos;altro fornitore che va
          dichiarato.
        </li>
        <li>
          OVH applica una modifica solo dopo un «refresh» della zona; local-cert lo attiva dopo
          ogni scrittura. La propagazione verso i server secondari può richiedere uno o due
          minuti: è il tempo normale di un&apos;emissione.
        </li>
        <li>TTL minimo: 60 secondi.</li>
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
                <code>Invalid signature</code>
              </td>
              <td>Application Secret o Consumer Key copiata male, oppure regione errata.</td>
            </tr>
            <tr>
              <td>
                <code>This credential is not valid</code>
              </td>
              <td>
                Consumer Key scaduta o revocata: ricreare un token con validità illimitata.
              </td>
            </tr>
            <tr>
              <td>
                <code>This call has not been granted</code>
              </td>
              <td>Manca una riga nei permessi del token.</td>
            </tr>
            <tr>
              <td>
                <code>This application key is invalid</code>
              </td>
              <td>Application Key di un&apos;altra regione.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

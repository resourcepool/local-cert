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
      <h1>Provider DNS</h1>
      <p className="lead">
        Un provider è un account presso il fornitore che ospita le zone DNS, con le credenziali
        che permettono a local-cert di scrivervi. È da qui che passa la prova richiesta da
        Let&apos;s Encrypt: un record TXT pubblicato per il tempo della convalida.
      </p>

      <h2>Fornitori supportati</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fornitore</th>
              <th>Servizio</th>
              <th>Credenziali</th>
              <th>TTL minimo</th>
              <th>Guida</th>
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
                      ? 'chiave IAM, ruolo consigliato'
                      : info.fields
                          .filter((f) => f.required)
                          .map((f) => f.label)
                          .join(', ')}
                  </td>
                  <td>{info.minTtl} s</td>
                  <td>
                    <Link href={`/admin/docs/${info.docs}`}>apri</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Il principio, qualunque sia il fornitore</h2>
      <ol>
        <li>
          Si creano presso il fornitore credenziali <b>limitate al DNS</b> — mai quelle
          dell&apos;account principale.
        </li>
        <li>
          <Link href="/admin/providers">Provider</Link> → <b>+ nuovo provider</b>: si sceglie il
          fornitore, si incollano le credenziali, si testa e si salva.
        </li>
        <li>
          <Link href="/admin/domains">Domini</Link> → <b>+ aggiungere un dominio</b>: local-cert
          elenca le zone dell&apos;account, se ne sceglie una e ne verifica i permessi.
        </li>
      </ol>
      <p>
        Avere più provider dello stesso fornitore è il caso normale: uno per account, oppure uno
        per ciascun perimetro di permessi. I segreti sono cifrati nel database (AES-256-GCM con{' '}
        <code>MASTER_KEY</code>) e non vengono mai mostrati di nuovo né restituiti dall&apos;API.
      </p>

      <h2>Cosa cambia da un fornitore all&apos;altro</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>AWS Route53</th>
              <th>Gli altri</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Permessi</td>
              <td>per zona: una policy IAM da aggiornare a ogni dominio aggiunto</td>
              <td>legati alle credenziali: nulla da modificare quando si aggiunge un dominio</td>
            </tr>
            <tr>
              <td>Test dei permessi</td>
              <td>senza alcuna scrittura nella zona</td>
              <td>
                un record TXT temporaneo (<code>_localcert-preflight-…</code>) viene creato e poi
                eliminato
              </td>
            </tr>
            <tr>
              <td>Scritture</td>
              <td>atomiche, seguite fino alla propagazione</td>
              <td>record per record</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout title="TTL minimo">
        Gandi (300 s) e GoDaddy (600 s) rifiutano i TTL brevi. local-cert aumenta allora in
        silenzio il valore richiesto. Ciò non impedisce l&apos;emissione — la convalida interroga
        direttamente i server autorevoli — ma un record <code>A</code> modificato impiegherà quel
        tempo per essere visibile ovunque.
      </Callout>

      <h2>Marcatura di ciò che local-cert crea</h2>
      <p>
        Ogni record pubblicato su richiesta è accompagnato da un TXT{' '}
        <code>_local-cert.&lt;nome&gt;</code>: è ciò che permette di distinguere, nella zona, ciò
        che proviene da local-cert da ciò che esisteva già. La variabile{' '}
        <code>TAG_RECORDS=0</code> lo disattiva.
      </p>

      <h2>Dichiarare un provider tramite variabili d&apos;ambiente</h2>
      <p>
        Quando le credenziali devono provenire dal deployment anziché dal database, un provider si
        dichiara tramite variabili. È facoltativo, e il blocco si ripete con un&apos;etichetta
        diversa per ogni account.
      </p>
      <CodeBlock
        title=".env"
        code={`# PROVIDER_<FORNITORE>_<ETICHETTA>_NAME dichiara il provider; il resto, le sue credenziali
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
PROVIDER_GCP_MAIN_SERVICE_ACCOUNT_JSON=<il JSON della chiave, o la sua codifica base64>
PROVIDER_GCP_MAIN_PROJECT_ID=mio-progetto   # facoltativo`}
      />
      <ul>
        <li>
          L&apos;etichetta (<code>DEFAULT</code>, <code>PERSO</code>, <code>MAIN</code>…) è libera:
          lettere maiuscole, cifre e trattini bassi.
        </li>
        <li>
          Questi provider compaiono nella console con la dicitura <i>ambiente</i>. Si possono
          testare, ma non modificare né rimuovere: ciò avviene nelle variabili, seguito da un
          riavvio. I loro segreti non vengono mai scritti nel database.
        </li>
        <li>
          Una dichiarazione incompleta viene ignorata, con un messaggio all&apos;avvio che indica
          la variabile mancante.
        </li>
      </ul>
    </>
  );
}

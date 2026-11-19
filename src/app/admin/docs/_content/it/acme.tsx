import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EabValues, type DocCtx } from '../../_lib/prose';

export default function Acme({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Server ACME</h1>
      <p className="lead">
        local-cert espone un endpoint ACME (RFC 8555) su <code>/acme/directory</code>. Qualsiasi
        strumento in grado di richiedere un certificato a Let&apos;s Encrypt può richiederlo a
        local-cert, per host che Let&apos;s Encrypt non potrebbe mai raggiungere.
      </p>
      <CodeBlock title="Directory di questa istanza" code={ctx.directory} />

      <h2>Cos&apos;è e cosa non è</h2>
      <p>
        Non è un&apos;autorità di certificazione. local-cert non firma nulla: fa da intermediario
        tra il client ACME e Let&apos;s Encrypt, e il certificato ricevuto è un vero certificato
        Let&apos;s Encrypt, riconosciuto ovunque.
      </p>
      <p>
        Il problema che risolve: un client ACME classico dimostra di controllare un nome
        rispondendo sulla porta 80 (HTTP-01), il che presuppone che Let&apos;s Encrypt possa
        raggiungere la macchina. In una LAN è impossibile. La prova tramite DNS (DNS-01)
        funziona, ma obbliga a fornire credenziali DNS a ogni macchina. local-cert tiene queste
        credenziali per sé ed esegue la prova DNS al posto del client.
      </p>

      <h2>Come viene emesso un certificato</h2>
      <ol>
        <li>
          <b>Registrazione.</b> Il client crea il proprio account ACME presentando una credenziale
          EAB. Una volta sola; poi firma con la propria chiave di account.
        </li>
        <li>
          <b>Ordine.</b> Il client richiede un certificato per uno o più nomi. local-cert verifica
          che appartengano a un dominio gestito e che la credenziale EAB abbia il diritto di
          usarlo. In caso contrario l&apos;ordine viene rifiutato subito.
        </li>
        <li>
          <b>Challenge.</b> local-cert propone una challenge HTTP-01, come una CA ordinaria. Il
          client prepara la risposta e segnala di essere pronto.
        </li>
        <li>
          <b>Convalida effettiva.</b> local-cert non va mai a cercare la risposta HTTP. Al suo
          posto apre un ordine presso Let&apos;s Encrypt, scrive il record TXT{' '}
          <code>_acme-challenge</code> nella zona, attende la propagazione, fa convalidare e poi
          elimina il record. La challenge del client passa a <code>valid</code> a operazione
          conclusa.
        </li>
        <li>
          <b>Finalizzazione.</b> Il client invia la propria CSR. local-cert la inoltra a
          Let&apos;s Encrypt e restituisce la catena di certificati. La chiave privata non ha mai
          lasciato il client.
        </li>
      </ol>
      <Callout title="Conseguenze pratiche">
        <ul>
          <li>
            La porta 80 del client non deve essere raggiungibile, né da local-cert né da Internet.
            Il client deve solo poter contattare local-cert in HTTP(S).
          </li>
          <li>
            Il passaggio 4 richiede da uno a tre minuti: è il tempo della propagazione DNS. I
            client attendono da soli; non riducete i loro timeout.
          </li>
          <li>
            Viene proposto solo HTTP-01. Un client configurato esclusivamente per DNS-01 o
            TLS-ALPN-01 non troverà alcuna challenge compatibile.
          </li>
        </ul>
      </Callout>

      <h2>Le credenziali EAB</h2>
      <p>
        EAB sta per <i>External Account Binding</i>. È il meccanismo previsto da ACME perché una
        CA accetti solo i client che già conosce: al momento di creare l&apos;account, il client
        dimostra di possedere un segreto consegnato in anticipo. Qui sostituisce la chiave API.
      </p>
      <p>Una credenziale EAB si compone di due valori, più l&apos;URL del server:</p>
      <EabValues ctx={ctx} />
      <p>
        Si crea in <Link href="/admin/keys">Chiavi e permessi</Link> →{' '}
        <b>Credenziali EAB</b> → <b>+ nuova credenziale</b>, con:
      </p>
      <ul>
        <li>
          un <b>nome</b>, per sapere a quale client è stata consegnata;
        </li>
        <li>
          una <b>scadenza</b> facoltativa;
        </li>
        <li>
          i <b>domini autorizzati</b>: il client può richiedere certificati solo sotto di essi.
        </li>
      </ul>
      <h3>Cosa occorre sapere</h3>
      <ul>
        <li>
          La chiave HMAC viene mostrata una sola volta. Se va persa, occorre creare una nuova
          credenziale.
        </li>
        <li>
          Il client la usa solo per la registrazione, ma local-cert rilegge la credenziale a ogni
          richiesta: <b>revocarla</b> o lasciarla <b>scadere</b> esclude anche i client già
          registrati.
        </li>
        <li>
          Una credenziale può servire più client. Una credenziale per client permette di
          escluderli separatamente e di sapere chi ha emesso cosa.
        </li>
        <li>
          La chiave è codificata in base64url, il formato atteso da tutti i client (
          <code>hmacEncoded</code>, <code>--eab-hmac-key</code>, <code>mac_key</code>…).
        </li>
      </ul>

      <h2>Cosa deve saper fare il client</h2>
      <p>Tre cose, che quasi tutti i client ACME moderni offrono:</p>
      <ol>
        <li>usare un URL di directory personalizzato;</li>
        <li>registrarsi con un External Account Binding;</li>
        <li>risolvere una challenge HTTP-01.</li>
      </ol>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Strumento</th>
              <th>Supporto</th>
              <th>Guida</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Traefik', 'nativo', 'acme/traefik'],
              ['Caddy', 'nativo', 'acme/caddy'],
              ['Apache httpd', 'nativo (mod_md)', 'acme/apache'],
              ['Nginx', 'tramite certbot o acme.sh', 'acme/nginx'],
              ['HAProxy', 'tramite acme.sh', 'acme/haproxy'],
              ['Nginx Proxy Manager', 'importazione manuale', 'acme/nginx-proxy-manager'],
              ['Kubernetes', 'nativo (cert-manager)', 'acme/kubernetes'],
              ['Dokploy', 'nativo (Traefik)', 'acme/dokploy'],
              ['Coolify', 'nativo (Traefik)', 'acme/coolify'],
              ['Synology DSM', 'tramite acme.sh', 'acme/synology'],
              ['Proxmox VE', 'nativo (pvenode)', 'acme/proxmox'],
              ['certbot, acme.sh, lego', 'nativo', 'acme/clients'],
            ].map(([tool, support, slug]) => (
              <tr key={slug}>
                <td>{tool}</td>
                <td>{support}</td>
                <td>
                  <Link href={`/admin/docs/${slug}`}>apri</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Per tutto il resto, vedere <Link href="/admin/docs/acme/others">Altri sistemi</Link>.
      </p>

      <h2>Regole e limiti</h2>
      <ul>
        <li>
          Un nome al di fuori dei domini gestiti viene rifiutato (<code>rejectedIdentifier</code>);
          lo stesso vale per un dominio non autorizzato per la credenziale (
          <code>unauthorized</code>).
        </li>
        <li>Tutti i nomi di uno stesso ordine devono appartenere allo stesso dominio gestito.</li>
        <li>
          I wildcard (<code>*.home.example.com</code>) sono accettati: poiché la convalida effettiva
          avviene in DNS-01, la consueta restrizione di HTTP-01 non si applica. Alcuni client
          però rifiutano di per sé un wildcard in HTTP-01.
        </li>
        <li>
          Questi certificati compaiono in <Link href="/admin/certificates">Certificati</Link> con
          il tipo di chiave <code>external</code>, senza chiave privata né rinnovo automatico: il
          rinnovo spetta al client.
        </li>
        <li>
          Un account ACME può revocare i certificati che ha ottenuto. La rotazione della chiave
          di account (<code>keyChange</code>) non è implementata.
        </li>
      </ul>

      <h2>Risoluzione dei problemi</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sintomo</th>
              <th>Causa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>JWS &quot;url&quot; is … but this endpoint is …</code>
              </td>
              <td>
                local-cert si trova dietro un proxy che non inoltra{' '}
                <code>X-Forwarded-Proto</code> / <code>X-Forwarded-Host</code>. Inoltrarli, oppure
                impostare la variabile <code>PUBLIC_URL</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>externalAccountRequired</code>
              </td>
              <td>Il client si registra senza EAB. Verificarne la configurazione.</td>
            </tr>
            <tr>
              <td>
                <code>unauthorized</code> alla registrazione
              </td>
              <td>Credenziale sconosciuta, revocata o scaduta, oppure chiave HMAC errata.</td>
            </tr>
            <tr>
              <td>
                <code>rejectedIdentifier</code>
              </td>
              <td>Il nome richiesto non rientra in nessun dominio gestito.</td>
            </tr>
            <tr>
              <td>Il client si arrende dopo ~1 minuto</td>
              <td>
                Il suo timeout è più breve della convalida DNS. Rilanciare: l&apos;ordine in corso
                viene ripreso.
              </td>
            </tr>
            <tr>
              <td>Errore TLS verso local-cert</td>
              <td>
                local-cert è servito con un certificato che il client non riconosce. Servirlo con
                un certificato pubblico, oppure aggiungere la sua CA all&apos;archivio del client.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

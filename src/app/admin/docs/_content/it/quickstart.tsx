import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function Quickstart({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Avvio rapido</h1>
      <p className="lead">
        local-cert ottiene certificati Let&apos;s Encrypt per macchine non raggiungibili da
        Internet: NAS, hypervisor, servizi interni. La convalida passa dal DNS (DNS-01), quindi
        solo local-cert ha bisogno di accedere alla zona.
      </p>

      <h2>Il percorso completo</h2>
      <ol>
        <li>
          <b>Dichiarare un provider DNS.</b> È l&apos;account presso il fornitore che ospita la
          zona, con le relative credenziali: AWS, OVHcloud, Gandi, GoDaddy o Google Cloud. Pagina{' '}
          <Link href="/admin/providers">Provider</Link>, guide{' '}
          <Link href="/admin/docs/providers">Provider DNS</Link>.
        </li>
        <li>
          <b>Aggiungere un dominio.</b> Si sceglie una zona del provider, local-cert genera la
          policy IAM da incollare, verifica i permessi e infine salva. Pagina{' '}
          <Link href="/admin/domains">Domini</Link>, guida{' '}
          <Link href="/admin/docs/domains">Aggiungere un dominio</Link>.
        </li>
        <li>
          <b>Concedere un accesso.</b> In <Link href="/admin/keys">Chiavi e permessi</Link> si crea,
          a seconda dell&apos;esigenza, una <b>chiave API</b> (script, agenti) oppure una{' '}
          <b>credenziale EAB</b> (client ACME: Traefik, Caddy, certbot…).
        </li>
        <li>
          <b>Emettere.</b> Tramite il server ACME o tramite l&apos;API, come descritto di seguito.
        </li>
      </ol>

      <h2>Quale via scegliere</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Server ACME</th>
              <th>API REST</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Adatto a</td>
              <td>un reverse proxy o uno strumento che parla già ACME</td>
              <td>uno script, uno strumento senza ACME, un agente (MCP)</td>
            </tr>
            <tr>
              <td>Accesso</td>
              <td>credenziale EAB</td>
              <td>chiave API</td>
            </tr>
            <tr>
              <td>Chiave privata</td>
              <td>generata e conservata dal client</td>
              <td>generata da local-cert, cifrata nel database</td>
            </tr>
            <tr>
              <td>Rinnovo</td>
              <td>a cura del client</td>
              <td>a cura di local-cert (<code>auto_renew</code>)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Via ACME, con un solo comando</h2>
      <p>
        Con una credenziale EAB autorizzata sul dominio, qualsiasi client ACME ottiene un
        certificato. Esempio con certbot:
      </p>
      <CodeBlock
        title="certbot"
        code={`certbot certonly --standalone -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac}`}
      />
      <p>
        Il funzionamento e le guide per ciascuno strumento si trovano in{' '}
        <Link href="/admin/docs/acme">Server ACME</Link>.
      </p>

      <h2>Via API, con una sola richiesta</h2>
      <CodeBlock
        title="curl"
        code={`curl -X POST ${ctx.origin}/api/v1/certificates \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H 'content-type: application/json' \\
  -d '{
    "domains": ["${EX.host}"],
    "key_type": "ec-256",
    "auto_renew": true,
    "dns": { "create_record": true, "target_ip": "192.168.1.50" }
  }'`}
      />
      <p>
        La risposta è immediata (<code>202</code>); l&apos;emissione richiede da uno a tre minuti.
        Tutte le route sono descritte in <Link href="/admin/api">API</Link>.
      </p>

      <Callout title="Durante le prove">
        Il badge <code>acme:staging</code> in alto nella console indica che local-cert sta
        usando l&apos;ambiente di test di Let&apos;s Encrypt: i certificati non sono riconosciuti
        dai browser, ma non si consuma alcuna quota. Si passa alla produzione una volta
        convalidata la catena.
      </Callout>
    </>
  );
}

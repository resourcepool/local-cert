import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Traefik({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Traefik</h1>
      <p className="lead">
        Traefik (v2 e v3) gestisce una CA personalizzata e l&apos;EAB nei propri resolver di
        certificati. Basta dichiararne uno che punti a local-cert.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Dichiarare il resolver</h2>
      <p>Nella configurazione statica, in un file:</p>
      <CodeBlock
        title="traefik.yml"
        code={`entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

certificatesResolvers:
  localcert:
    acme:
      caServer: ${ctx.directory}
      email: ${EX.email}
      storage: /letsencrypt/localcert.json
      eab:
        kid: ${EX.kid}
        hmacEncoded: ${EX.hmac}
      httpChallenge:
        entryPoint: web`}
      />
      <p>oppure tramite argomenti, per un container:</p>
      <CodeBlock
        title="docker-compose.yml (estratto)"
        code={`services:
  traefik:
    image: traefik:v3
    command:
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --providers.docker=true
      - --certificatesresolvers.localcert.acme.caserver=${ctx.directory}
      - --certificatesresolvers.localcert.acme.email=${EX.email}
      - --certificatesresolvers.localcert.acme.storage=/letsencrypt/localcert.json
      - --certificatesresolvers.localcert.acme.eab.kid=${EX.kid}
      - --certificatesresolvers.localcert.acme.eab.hmacencoded=${EX.hmac}
      - --certificatesresolvers.localcert.acme.httpchallenge.entrypoint=web
    volumes:
      - ./letsencrypt:/letsencrypt
      - /var/run/docker.sock:/var/run/docker.sock:ro`}
      />
      <Callout kind="warn" title="Un file di storage per CA">
        Assegnare a questo resolver un proprio file <code>storage</code>. Riutilizzare
        l&apos;<code>acme.json</code> di un resolver Let&apos;s Encrypt esistente mescola due
        account ACME e fa fallire la registrazione.
      </Callout>

      <h2>2. Usarlo su un router</h2>
      <CodeBlock
        title="label del servizio"
        code={`labels:
  - traefik.enable=true
  - traefik.http.routers.nas.rule=Host(\`${EX.host}\`)
  - traefik.http.routers.nas.entrypoints=websecure
  - traefik.http.routers.nas.tls.certresolver=localcert`}
      />
      <p>
        Traefik richiede il certificato al primo avvio del router, poi lo rinnova da solo (30
        giorni prima della scadenza per impostazione predefinita).
      </p>

      <h2>Da sapere</h2>
      <ul>
        <li>
          L&apos;entrypoint indicato da <code>httpChallenge</code> deve esistere, ma non riceverà
          alcuna richiesta di convalida: non occorre esporlo al di fuori della LAN.
        </li>
        <li>
          L&apos;emissione richiede da uno a tre minuti. Nel frattempo Traefik serve il proprio
          certificato predefinito; è normale.
        </li>
        <li>
          Per un wildcard, dichiarare i nomi sul router con <code>tls.domains[0].main</code> /{' '}
          <code>sans</code>. Se Traefik rifiuta il wildcard in HTTP-01, emetterlo tramite
          l&apos;<Link href="/admin/api">API</Link>.
        </li>
        <li>
          In caso di errore, i log di Traefik a livello <code>DEBUG</code> riportano l&apos;errore
          ACME restituito da local-cert — vedere la tabella di risoluzione dei problemi in{' '}
          <Link href="/admin/docs/acme">Server ACME</Link>.
        </li>
      </ul>
    </>
  );
}

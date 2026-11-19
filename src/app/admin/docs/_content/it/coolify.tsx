import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Coolify({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Coolify</h1>
      <p className="lead">
        Il proxy predefinito di Coolify è Traefik, configurato tramite argomenti. Gli si aggiunge
        un resolver per local-cert, poi lo si indica nelle label delle applicazioni interessate.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Aggiungere il resolver</h2>
      <p>
        <b>Servers</b> → il proprio server → <b>Proxy</b> → <b>Configuration</b>. Nella sezione{' '}
        <code>command</code> del servizio Traefik, dopo le righe{' '}
        <code>--certificatesresolvers.letsencrypt…</code>, aggiungere:
      </p>
      <CodeBlock
        title="configurazione del proxy (estratto)"
        code={`      - '--certificatesresolvers.localcert.acme.caserver=${ctx.directory}'
      - '--certificatesresolvers.localcert.acme.email=${EX.email}'
      - '--certificatesresolvers.localcert.acme.storage=/traefik/acme-localcert.json'
      - '--certificatesresolvers.localcert.acme.eab.kid=${EX.kid}'
      - '--certificatesresolvers.localcert.acme.eab.hmacencoded=${EX.hmac}'
      - '--certificatesresolvers.localcert.acme.httpchallenge.entrypoint=http'`}
      />
      <p>
        Salvare, quindi <b>Restart Proxy</b>. In Coolify gli entrypoint si chiamano{' '}
        <code>http</code> e <code>https</code>.
      </p>

      <h2>2. Usarlo su un&apos;applicazione</h2>
      <ol>
        <li>
          Assegnare all&apos;applicazione il dominio <code>https://{EX.host}</code>.
        </li>
        <li>
          Nelle sue impostazioni, deselezionare l&apos;opzione che rende le label del container
          in sola lettura.
        </li>
        <li>
          Nelle label, sostituire <code>certresolver=letsencrypt</code> con{' '}
          <code>certresolver=localcert</code> sul router HTTPS.
        </li>
        <li>Ridistribuire.</li>
      </ol>
      <CodeBlock
        title="label attesa"
        code={`traefik.http.routers.https-0-xxxxxxxx.tls.certresolver=localcert`}
      />

      <Callout title="Tutto il server su local-cert">
        Se questo server ospita solo servizi interni, è più semplice non modificare le label e
        reindirizzare il resolver <code>letsencrypt</code> stesso: aggiungere le righe{' '}
        <code>caserver</code>, <code>eab.kid</code> e <code>eab.hmacencoded</code> a questo
        resolver, eliminare il suo <code>acme.json</code> esistente, riavviare il proxy.
      </Callout>

      <h2>Da sapere</h2>
      <ul>
        <li>
          Se il proxy del server è Caddy, seguire invece la guida{' '}
          <Link href="/admin/docs/acme/caddy">Caddy</Link>.
        </li>
        <li>
          Una rigenerazione delle label da parte di Coolify ripristina <code>letsencrypt</code>:
          per questo la sola lettura deve restare disattivata su queste applicazioni.
        </li>
      </ul>
    </>
  );
}

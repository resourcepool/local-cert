import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Dokploy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Dokploy</h1>
      <p className="lead">
        Dokploy instrada tutto tramite Traefik. Gli si aggiunge un secondo resolver di
        certificati, accanto a quello di Let&apos;s Encrypt, e lo si sceglie dominio per dominio.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Aggiungere il resolver</h2>
      <p>
        In Dokploy: <b>Web Server</b> → <b>Traefik</b> → modificare la configurazione principale
        (file <code>/etc/dokploy/traefik/traefik.yml</code> sul server). Sotto{' '}
        <code>certificatesResolvers</code>, mantenere <code>letsencrypt</code> e aggiungere:
      </p>
      <CodeBlock
        title="traefik.yml (estratto)"
        code={`certificatesResolvers:
  letsencrypt:
    # … invariato …
  localcert:
    acme:
      caServer: ${ctx.directory}
      email: ${EX.email}
      storage: /etc/dokploy/traefik/dynamic/acme-localcert.json
      eab:
        kid: ${EX.kid}
        hmacEncoded: ${EX.hmac}
      httpChallenge:
        entryPoint: web`}
      />
      <p>
        Salvare, quindi ricaricare Traefik dalla stessa pagina (<b>Reload</b>). La configurazione
        statica viene riletta solo al riavvio di Traefik.
      </p>

      <h2>2. Usarlo su un dominio</h2>
      <ol>
        <li>
          Nell&apos;applicazione → <b>Domains</b> → aggiungere <code>{EX.host}</code>.
        </li>
        <li>
          Attivare <b>HTTPS</b>.
        </li>
        <li>
          Provider del certificato: <b>Custom</b>, resolver <code>localcert</code>.
        </li>
      </ol>
      <Callout title="Nessuna opzione «Custom»?">
        Sulle versioni di Dokploy che offrono solo <i>None</i> e <i>Let&apos;s Encrypt</i>, due
        soluzioni: aggiornare Dokploy, oppure modificare in <b>Traefik</b> → file dinamici il
        router dell&apos;applicazione sostituendovi <code>certResolver: letsencrypt</code> con{' '}
        <code>certResolver: localcert</code>.
      </Callout>

      <h2>3. Il DNS</h2>
      <p>
        <code>{EX.host}</code> deve puntare all&apos;indirizzo LAN del server Dokploy. local-cert
        può pubblicare questo record <code>A</code> al posto dell&apos;utente: vedere <b>DNS</b>{' '}
        nell&apos;<Link href="/admin/api">API</Link>.
      </p>

      <h2>Da sapere</h2>
      <ul>
        <li>
          I domini pubblici delle altre applicazioni restano su <code>letsencrypt</code>: i due
          resolver convivono.
        </li>
        <li>
          Mantenere un file <code>storage</code> distinto per ciascun resolver, come sopra.
        </li>
        <li>
          Per il resto il comportamento è quello di Traefik: vedere{' '}
          <Link href="/admin/docs/acme/traefik">Traefik</Link>.
        </li>
      </ul>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Coolify({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Coolify</h1>
      <p className="lead">
        Le proxy par défaut de Coolify est Traefik, configuré par arguments. On y ajoute un
        resolver pour local-cert, puis on l&apos;indique dans les labels des applications
        concernées.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Ajouter le resolver</h2>
      <p>
        <b>Servers</b> → votre serveur → <b>Proxy</b> → <b>Configuration</b>. Dans la section{' '}
        <code>command</code> du service Traefik, à la suite des lignes{' '}
        <code>--certificatesresolvers.letsencrypt…</code>, ajoutez :
      </p>
      <CodeBlock
        title="configuration du proxy (extrait)"
        code={`      - '--certificatesresolvers.localcert.acme.caserver=${ctx.directory}'
      - '--certificatesresolvers.localcert.acme.email=${EX.email}'
      - '--certificatesresolvers.localcert.acme.storage=/traefik/acme-localcert.json'
      - '--certificatesresolvers.localcert.acme.eab.kid=${EX.kid}'
      - '--certificatesresolvers.localcert.acme.eab.hmacencoded=${EX.hmac}'
      - '--certificatesresolvers.localcert.acme.httpchallenge.entrypoint=http'`}
      />
      <p>
        Enregistrez, puis <b>Restart Proxy</b>. Dans Coolify, les entrypoints s&apos;appellent{' '}
        <code>http</code> et <code>https</code>.
      </p>

      <h2>2. L&apos;utiliser sur une application</h2>
      <ol>
        <li>
          Donnez à l&apos;application le domaine <code>https://{EX.host}</code>.
        </li>
        <li>
          Dans ses réglages, décochez l&apos;option qui rend les labels du conteneur en lecture
          seule.
        </li>
        <li>
          Dans les labels, remplacez <code>certresolver=letsencrypt</code> par{' '}
          <code>certresolver=localcert</code> sur le routeur HTTPS.
        </li>
        <li>Redéployez.</li>
      </ol>
      <CodeBlock
        title="label attendu"
        code={`traefik.http.routers.https-0-xxxxxxxx.tls.certresolver=localcert`}
      />

      <Callout title="Tout le serveur sur local-cert">
        Si ce serveur n&apos;héberge que des services internes, il est plus simple de ne rien
        changer aux labels et de rediriger le resolver <code>letsencrypt</code> lui-même : ajoutez
        les lignes <code>caserver</code>, <code>eab.kid</code> et <code>eab.hmacencoded</code> à
        ce resolver, supprimez son <code>acme.json</code> existant, redémarrez le proxy.
      </Callout>

      <h2>À savoir</h2>
      <ul>
        <li>
          Si le proxy du serveur est Caddy, suivez plutôt le guide{' '}
          <Link href="/admin/docs/acme/caddy">Caddy</Link>.
        </li>
        <li>
          Une régénération des labels par Coolify remet <code>letsencrypt</code> : c&apos;est
          pourquoi la lecture seule doit rester désactivée sur ces applications.
        </li>
      </ul>
    </>
  );
}

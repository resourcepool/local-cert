import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Traefik({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Traefik</h1>
      <p className="lead">
        Traefik (v2 et v3) gère une CA personnalisée et l&apos;EAB dans ses resolvers de
        certificats. Il suffit d&apos;en déclarer un qui pointe sur local-cert.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Déclarer le resolver</h2>
      <p>Dans la configuration statique, en fichier :</p>
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
      <p>ou en arguments, pour un conteneur :</p>
      <CodeBlock
        title="docker-compose.yml (extrait)"
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
      <Callout kind="warn" title="Un fichier de stockage par CA">
        Donnez à ce resolver son propre fichier <code>storage</code>. Réutiliser le{' '}
        <code>acme.json</code> d&apos;un resolver Let&apos;s Encrypt existant mélange deux comptes
        ACME et fait échouer l&apos;enregistrement.
      </Callout>

      <h2>2. L&apos;utiliser sur un routeur</h2>
      <CodeBlock
        title="labels du service"
        code={`labels:
  - traefik.enable=true
  - traefik.http.routers.nas.rule=Host(\`${EX.host}\`)
  - traefik.http.routers.nas.entrypoints=websecure
  - traefik.http.routers.nas.tls.certresolver=localcert`}
      />
      <p>
        Traefik demande le certificat au premier démarrage du routeur, puis le renouvelle seul
        (30 jours avant l&apos;échéance par défaut).
      </p>

      <h2>À savoir</h2>
      <ul>
        <li>
          L&apos;entrypoint désigné par <code>httpChallenge</code> doit exister, mais il ne recevra
          aucune requête de validation : inutile de l&apos;exposer hors du LAN.
        </li>
        <li>
          L&apos;émission prend une à trois minutes. Pendant ce temps Traefik sert son certificat
          par défaut ; c&apos;est normal.
        </li>
        <li>
          Pour un joker, déclarez les noms sur le routeur avec{' '}
          <code>tls.domains[0].main</code> / <code>sans</code>. Si Traefik refuse le joker en
          HTTP-01, émettez-le par l&apos;<Link href="/admin/api">API</Link>.
        </li>
        <li>
          En cas d&apos;échec, les journaux de Traefik au niveau <code>DEBUG</code> reproduisent
          l&apos;erreur ACME renvoyée par local-cert — voir le tableau de dépannage dans{' '}
          <Link href="/admin/docs/acme">Serveur ACME</Link>.
        </li>
      </ul>
    </>
  );
}

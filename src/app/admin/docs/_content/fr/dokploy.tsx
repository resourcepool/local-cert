import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Dokploy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Dokploy</h1>
      <p className="lead">
        Dokploy route tout par Traefik. On lui ajoute un second resolver de certificats, à côté
        de celui de Let&apos;s Encrypt, puis on le choisit domaine par domaine.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Ajouter le resolver</h2>
      <p>
        Dans Dokploy : <b>Web Server</b> → <b>Traefik</b> → modifier la configuration principale
        (fichier <code>/etc/dokploy/traefik/traefik.yml</code> sur le serveur). Sous{' '}
        <code>certificatesResolvers</code>, gardez <code>letsencrypt</code> et ajoutez :
      </p>
      <CodeBlock
        title="traefik.yml (extrait)"
        code={`certificatesResolvers:
  letsencrypt:
    # … inchangé …
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
        Enregistrez, puis rechargez Traefik depuis la même page (<b>Reload</b>). La configuration
        statique n&apos;est relue qu&apos;au redémarrage de Traefik.
      </p>

      <h2>2. L&apos;utiliser sur un domaine</h2>
      <ol>
        <li>
          Dans l&apos;application → <b>Domains</b> → ajoutez <code>{EX.host}</code>.
        </li>
        <li>
          Activez <b>HTTPS</b>.
        </li>
        <li>
          Fournisseur de certificat : <b>Custom</b>, resolver <code>localcert</code>.
        </li>
      </ol>
      <Callout title="Pas d'option « Custom » ?">
        Sur les versions de Dokploy qui ne proposent que <i>None</i> et <i>Let&apos;s Encrypt</i>,
        deux solutions : mettre à jour Dokploy, ou éditer dans <b>Traefik</b> → fichiers
        dynamiques le routeur de l&apos;application pour y remplacer{' '}
        <code>certResolver: letsencrypt</code> par <code>certResolver: localcert</code>.
      </Callout>

      <h2>3. Le DNS</h2>
      <p>
        <code>{EX.host}</code> doit pointer sur l&apos;adresse LAN du serveur Dokploy. local-cert
        peut publier cet enregistrement <code>A</code> pour vous : voir <b>DNS</b> dans l&apos;
        <Link href="/admin/api">API</Link>.
      </p>

      <h2>À savoir</h2>
      <ul>
        <li>
          Les domaines publics de vos autres applications restent sur <code>letsencrypt</code> :
          les deux resolvers cohabitent.
        </li>
        <li>
          Gardez un fichier <code>storage</code> distinct par resolver, comme ci-dessus.
        </li>
        <li>
          Le reste du comportement est celui de Traefik : voir{' '}
          <Link href="/admin/docs/acme/traefik">Traefik</Link>.
        </li>
      </ul>
    </>
  );
}

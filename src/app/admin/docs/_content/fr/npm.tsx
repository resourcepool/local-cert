import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function NginxProxyManager({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Nginx Proxy Manager</h1>
      <p className="lead">
        L&apos;interface de Nginx Proxy Manager ne permet de choisir ni le serveur ACME ni un EAB :
        son émission intégrée ne parle qu&apos;à Let&apos;s Encrypt. Le certificat est donc obtenu
        à côté, puis importé comme certificat personnalisé.
      </p>

      <h2>1. Obtenir le certificat</h2>
      <p>
        Sur l&apos;hôte, avec acme.sh (voir{' '}
        <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link> pour le détail) :
      </p>
      <CodeBlock
        title="acme.sh"
        code={`acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid eab_XXXXXXXXXXXXXXXX --eab-hmac-key CLE_HMAC -m ops@example.com

mkdir -p /var/lib/acme-webroot /opt/npm-certs
acme.sh --issue --server ${ctx.directory} -d ${EX.host} -w /var/lib/acme-webroot
acme.sh --install-cert -d ${EX.host} \\
  --key-file       /opt/npm-certs/${EX.host}.key \\
  --fullchain-file /opt/npm-certs/${EX.host}.pem`}
      />

      <h2>2. L&apos;importer</h2>
      <ol>
        <li>
          <b>SSL Certificates</b> → <b>Add SSL Certificate</b> → <b>Custom</b>.
        </li>
        <li>
          Clé : <code>{EX.host}.key</code>. Certificat : <code>{EX.host}.pem</code>.
        </li>
        <li>
          Dans le <b>Proxy Host</b>, onglet <b>SSL</b>, choisissez ce certificat.
        </li>
      </ol>

      <Callout kind="warn" title="Le renouvellement n'est pas automatique">
        acme.sh renouvelle les fichiers, mais Nginx Proxy Manager garde la copie importée. Tous
        les deux mois environ, réimportez le certificat — ou, si vous avez le choix, préférez un
        proxy qui parle ACME avec une CA personnalisée (Traefik, Caddy), où tout est automatique.
      </Callout>

      <h2>Autre voie : laisser local-cert gérer la clé</h2>
      <p>
        Par l&apos;<Link href="/admin/api">API</Link>, local-cert génère la clé, renouvelle seul
        et expose le certificat à jour. Un script planifié n&apos;a plus qu&apos;à télécharger le
        bundle et à le pousser dans Nginx Proxy Manager. Voir{' '}
        <Link href="/admin/docs/acme/others">Autres systèmes</Link>.
      </p>
    </>
  );
}

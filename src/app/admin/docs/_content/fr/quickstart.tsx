import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function Quickstart({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Démarrage rapide</h1>
      <p className="lead">
        local-cert obtient des certificats Let&apos;s Encrypt pour des machines qui ne sont pas
        joignables depuis Internet : NAS, hyperviseurs, services internes. La validation passe par
        le DNS (DNS-01), donc seul local-cert a besoin d&apos;un accès à votre zone.
      </p>

      <h2>Le chemin complet</h2>
      <ol>
        <li>
          <b>Déclarer un provider DNS.</b> C&apos;est le compte chez l&apos;hébergeur de votre zone,
          avec ses identifiants : AWS, OVHcloud, Gandi, GoDaddy ou Google Cloud. Page{' '}
          <Link href="/admin/providers">Providers</Link>, guides{' '}
          <Link href="/admin/docs/providers">Providers DNS</Link>.
        </li>
        <li>
          <b>Ajouter un domaine.</b> Vous choisissez une zone du provider, local-cert génère la
          politique IAM à coller, teste les droits, puis enregistre. Page{' '}
          <Link href="/admin/domains">Domaines</Link>, guide{' '}
          <Link href="/admin/docs/domains">Ajouter un domaine</Link>.
        </li>
        <li>
          <b>Donner un accès.</b> Dans <Link href="/admin/keys">Clés &amp; droits</Link>, créez
          selon le besoin une <b>clé d&apos;API</b> (scripts, agents) ou un{' '}
          <b>identifiant EAB</b> (clients ACME : Traefik, Caddy, certbot…).
        </li>
        <li>
          <b>Émettre.</b> Par le serveur ACME ou par l&apos;API — voir ci-dessous.
        </li>
      </ol>

      <h2>Quelle voie choisir</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Serveur ACME</th>
              <th>API REST</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Pour</td>
              <td>un reverse proxy ou un outil qui sait déjà parler ACME</td>
              <td>un script, un outil sans ACME, un agent (MCP)</td>
            </tr>
            <tr>
              <td>Accès</td>
              <td>identifiant EAB</td>
              <td>clé d&apos;API</td>
            </tr>
            <tr>
              <td>Clé privée</td>
              <td>générée et gardée par le client</td>
              <td>générée par local-cert, chiffrée en base</td>
            </tr>
            <tr>
              <td>Renouvellement</td>
              <td>par le client</td>
              <td>par local-cert (<code>auto_renew</code>)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Voie ACME, en une commande</h2>
      <p>
        Avec un identifiant EAB autorisé sur le domaine, n&apos;importe quel client ACME obtient un
        certificat. Exemple avec certbot :
      </p>
      <CodeBlock
        title="certbot"
        code={`certbot certonly --standalone -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac}`}
      />
      <p>
        Le fonctionnement et les guides par outil sont dans{' '}
        <Link href="/admin/docs/acme">Serveur ACME</Link>.
      </p>

      <h2>Voie API, en une requête</h2>
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
        La réponse est immédiate (<code>202</code>) ; l&apos;émission prend une à trois minutes.
        Toutes les routes sont décrites dans <Link href="/admin/api">API</Link>.
      </p>

      <Callout title="Pendant les essais">
        Le badge <code>acme:staging</code> en haut de la console indique que local-cert parle à
        l&apos;environnement de test de Let&apos;s Encrypt : les certificats ne sont pas reconnus
        par les navigateurs, mais vous ne consommez aucun quota. Passez en production une fois la
        chaîne validée.
      </Callout>
    </>
  );
}

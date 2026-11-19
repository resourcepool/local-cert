import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function Others({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Autres systèmes</h1>
      <p className="lead">
        Deux recettes couvrent tout ce qui n&apos;a pas son propre guide : un client ACME
        générique quand le système en accepte un, l&apos;API de local-cert quand il ne sait
        qu&apos;importer un certificat.
      </p>

      <h2>Reconnaître le bon cas</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Le système…</th>
              <th>Recette</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>a un client ACME avec URL de CA personnalisée, EAB et HTTP-01</td>
              <td>
                le configurer avec les trois valeurs de l&apos;identifiant EAB, comme dans{' '}
                <Link href="/admin/docs/acme">Serveur ACME</Link>
              </td>
            </tr>
            <tr>
              <td>donne un accès shell</td>
              <td>
                acme.sh et un hook de déploiement — voir{' '}
                <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>
              </td>
            </tr>
            <tr>
              <td>ne sait qu&apos;importer un certificat, ou seulement faire du DNS-01</td>
              <td>l&apos;API de local-cert, ci-dessous</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Repères par système</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Système</th>
              <th>Approche</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>OPNsense</td>
              <td>
                Greffon <code>os-acme-client</code> : créez un compte sur une CA personnalisée avec
                l&apos;URL du directory et les champs EAB, puis un certificat en challenge
                HTTP-01. Le greffon s&apos;appuie sur acme.sh.
              </td>
            </tr>
            <tr>
              <td>pfSense</td>
              <td>
                Paquet ACME : si votre version propose un serveur ACME personnalisé avec EAB,
                même démarche. Sinon, acme.sh en shell puis import dans <b>System</b> →{' '}
                <b>Certificates</b>.
              </td>
            </tr>
            <tr>
              <td>TrueNAS</td>
              <td>
                Son client ACME ne fait que du DNS-01 avec ses propres fournisseurs : utilisez
                l&apos;API de local-cert, puis importez le certificat.
              </td>
            </tr>
            <tr>
              <td>Unraid, UniFi, imprimantes, iDRAC/iLO, équipements réseau</td>
              <td>Import de certificat : API de local-cert.</td>
            </tr>
            <tr>
              <td>Zoraxy, SWAG, proxys basés sur lego ou certbot</td>
              <td>
                S&apos;ils exposent l&apos;URL de CA et l&apos;EAB, cas générique. Sinon, import.
              </td>
            </tr>
            <tr>
              <td>Envoy, proxys sans client ACME</td>
              <td>
                acme.sh ou lego à côté, fichiers montés dans le proxy, rechargement en hook.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout title="Avant d'essayer un client ACME intégré">
        Vérifiez les trois prérequis : URL de directory libre, External Account Binding, challenge
        HTTP-01. S&apos;il en manque un, passez directement à l&apos;API : vous gagnerez du temps.
      </Callout>

      <h2>Recette API : local-cert garde la clé et renouvelle</h2>
      <p>
        Ici le système cible ne parle pas à local-cert. C&apos;est local-cert qui génère la clé,
        obtient le certificat, le renouvelle, et un script vient chercher la version à jour. Il
        faut une <b>clé d&apos;API</b> (<Link href="/admin/keys">Clés &amp; droits</Link>) avec les
        droits <code>cert:issue</code>, <code>cert:read</code> et <code>cert:export</code> sur le
        domaine.
      </p>
      <h3>1. Demander le certificat, une fois</h3>
      <CodeBlock
        title="curl"
        code={`curl -X POST ${ctx.origin}/api/v1/certificates \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H 'content-type: application/json' \\
  -d '{"domains": ["${EX.host}"], "key_type": "ec-256", "auto_renew": true}'
# → { "id": "cert_…", "status": "pending", … }`}
      />
      <h3>2. Récupérer certificat et clé, à chaque passage</h3>
      <CodeBlock
        title="script planifié (cron, quotidien)"
        code={`#!/bin/sh
set -eu
ID=cert_XXXXXXXXXXXXXXXX
OUT=/etc/ssl/local-cert

curl -fsS -H "Authorization: Bearer $TOKEN" \\
  "${ctx.origin}/api/v1/certificates/$ID/bundle?format=pem&include=fullchain" \\
  -o "$OUT/fullchain.pem.new"
curl -fsS -H "Authorization: Bearer $TOKEN" \\
  "${ctx.origin}/api/v1/certificates/$ID/bundle?format=pem&include=key" \\
  -o "$OUT/privkey.pem.new"

# ne recharge que si le certificat a changé
if ! cmp -s "$OUT/fullchain.pem.new" "$OUT/fullchain.pem"; then
  mv "$OUT/fullchain.pem.new" "$OUT/fullchain.pem"
  mv "$OUT/privkey.pem.new"  "$OUT/privkey.pem"
  # ici : la commande d'import ou de rechargement du système cible
fi`}
      />
      <p>
        Plutôt que d&apos;interroger chaque jour, la demande accepte un <code>webhook_url</code>{' '}
        appelé à chaque émission et renouvellement. Le détail des routes est dans{' '}
        <Link href="/admin/api">API</Link>.
      </p>
    </>
  );
}

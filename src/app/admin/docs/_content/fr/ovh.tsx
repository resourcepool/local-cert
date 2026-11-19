import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout } from '../../_lib/prose';

const RIGHTS = `GET    /domain/zone
GET    /domain/zone/*
POST   /domain/zone/*
PUT    /domain/zone/*
DELETE /domain/zone/*`;

export default function Ovh() {
  return (
    <>
      <h1>Provider OVHcloud</h1>
      <p className="lead">
        local-cert pilote les zones DNS OVHcloud par l&apos;API d&apos;OVH, avec un jeu de trois
        clés limité au DNS.
      </p>

      <h2>1. Créer le token</h2>
      <p>
        OVH propose une page qui crée les trois clés d&apos;un coup. Ouvrez celle de votre région
        en étant connecté à votre compte :
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Compte</th>
              <th>Page de création</th>
              <th>Valeur de « Région de l&apos;API »</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Europe</td>
              <td>
                <code>https://eu.api.ovh.com/createToken/</code>
              </td>
              <td>
                <code>ovh-eu</code>
              </td>
            </tr>
            <tr>
              <td>Canada</td>
              <td>
                <code>https://ca.api.ovh.com/createToken/</code>
              </td>
              <td>
                <code>ovh-ca</code>
              </td>
            </tr>
            <tr>
              <td>États-Unis</td>
              <td>
                <code>https://api.us.ovhcloud.com/createToken/</code>
              </td>
              <td>
                <code>ovh-us</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ol>
        <li>
          <b>Application name</b> : <code>local-cert</code>. Description libre.
        </li>
        <li>
          <b>Validity</b> : <b>Unlimited</b>. Un token à durée limitée cesserait de fonctionner
          sans prévenir, renouvellements compris.
        </li>
        <li>
          <b>Rights</b> : ajoutez ces cinq lignes (le lien proposé par l&apos;assistant de
          local-cert les préremplit) :
        </li>
      </ol>
      <CodeBlock title="Droits à accorder" code={RIGHTS} />
      <ol start={4}>
        <li>
          <b>Create keys</b>. La page affiche l&apos;<b>Application Key</b>, l&apos;
          <b>Application Secret</b> et la <b>Consumer Key</b> : notez les trois.
        </li>
      </ol>
      <Callout title="Limiter à une seule zone">
        Pour ne donner accès qu&apos;à un domaine, remplacez <code>*</code> par son nom dans les
        droits : <code>/domain/zone/example.com</code> et <code>/domain/zone/example.com/*</code>.
        Gardez <code>GET /domain/zone</code>, qui sert à lister les zones.
      </Callout>

      <h2>2. Créer le provider</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Providers</Link> → <b>+ nouveau provider</b> →{' '}
          <b>OVHcloud</b>.
        </li>
        <li>Choisissez la région, donnez un nom, collez les trois clés.</li>
        <li>
          <b>Tester la connexion</b> : local-cert liste vos zones. Puis <b>Enregistrer</b>.
        </li>
      </ol>

      <h2>3. Ajouter un domaine</h2>
      <p>
        <Link href="/admin/domains">Domaines</Link> → <b>+ ajouter un domaine</b> → ce provider →
        la zone. Le test crée puis supprime un enregistrement TXT temporaire. Aucun réglage
        supplémentaire côté OVH : les droits sont ceux du token.
      </p>

      <h2>À savoir</h2>
      <ul>
        <li>
          Le domaine doit utiliser les <b>serveurs DNS d&apos;OVH</b> (zone DNS active dans
          l&apos;espace client). Si ses serveurs de noms pointent ailleurs, c&apos;est cet autre
          hébergeur qu&apos;il faut déclarer.
        </li>
        <li>
          OVH n&apos;applique une modification qu&apos;après un « rafraîchissement » de la zone ;
          local-cert le déclenche après chaque écriture. La propagation vers les serveurs
          secondaires peut prendre une à deux minutes : c&apos;est le délai normal d&apos;une
          émission.
        </li>
        <li>TTL minimal : 60 secondes.</li>
      </ul>

      <h2>Dépannage</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Message</th>
              <th>Cause</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>Invalid signature</code>
              </td>
              <td>Application Secret ou Consumer Key mal recopiée, ou mauvaise région.</td>
            </tr>
            <tr>
              <td>
                <code>This credential is not valid</code>
              </td>
              <td>Consumer Key expirée ou révoquée : recréez un token en validité illimitée.</td>
            </tr>
            <tr>
              <td>
                <code>This call has not been granted</code>
              </td>
              <td>Il manque une ligne dans les droits du token.</td>
            </tr>
            <tr>
              <td>
                <code>This application key is invalid</code>
              </td>
              <td>Application Key d&apos;une autre région.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

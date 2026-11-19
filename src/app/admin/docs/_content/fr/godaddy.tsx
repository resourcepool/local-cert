import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function GoDaddy() {
  return (
    <>
      <h1>Provider GoDaddy</h1>
      <p className="lead">
        local-cert pilote le DNS GoDaddy avec une clé d&apos;API de production. Vérifiez
        d&apos;abord que votre compte y a droit : GoDaddy ne l&apos;ouvre pas à tous.
      </p>

      <Callout kind="warn" title="Condition d'accès à l'API">
        GoDaddy réserve ses API de gestion de domaines et de DNS aux comptes qui détiennent au
        moins dix domaines, ou un abonnement Discount Domain Club. En dessous, la clé se crée
        normalement mais chaque appel répond <code>403 ACCESS_DENIED</code>. Si c&apos;est votre
        cas, la solution durable est de déléguer le sous-domaine concerné à un hébergeur DNS pris
        en charge — voir en bas de page.
      </Callout>

      <h2>1. Créer la clé</h2>
      <ol>
        <li>
          Ouvrez <code>https://developer.godaddy.com/keys</code>, connecté au compte qui détient
          les domaines.
        </li>
        <li>
          <b>Create New API Key</b>. Nom : <code>local-cert</code>. Environnement :{' '}
          <b>Production</b> (une clé <i>OTE</i> ne voit pas vos vrais domaines).
        </li>
        <li>
          Copiez la <b>Key</b> et le <b>Secret</b> : le secret n&apos;est affiché qu&apos;une
          fois.
        </li>
      </ol>
      <p>
        Une clé GoDaddy donne accès à tout le compte : il n&apos;existe pas de restriction par
        domaine ni par type d&apos;opération.
      </p>

      <h2>2. Créer le provider</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Providers</Link> → <b>+ nouveau provider</b> →{' '}
          <b>GoDaddy</b>.
        </li>
        <li>Donnez un nom, collez la clé et le secret.</li>
        <li>
          <b>Tester la connexion</b>, puis <b>Enregistrer</b>.
        </li>
      </ol>

      <h2>3. Ajouter un domaine</h2>
      <p>
        <Link href="/admin/domains">Domaines</Link> → <b>+ ajouter un domaine</b> → ce provider →
        le domaine. Le test crée puis supprime un enregistrement TXT temporaire.
      </p>

      <h2>À savoir</h2>
      <ul>
        <li>
          Le domaine doit utiliser les serveurs de noms de GoDaddy (
          <code>ns*.domaincontrol.com</code>).
        </li>
        <li>
          <b>TTL minimal : 600 secondes.</b> local-cert relève toute valeur plus basse. Sans effet
          sur l&apos;émission des certificats.
        </li>
      </ul>

      <h2>Si votre compte n&apos;a pas accès à l&apos;API</h2>
      <p>
        Gardez le domaine chez GoDaddy et déléguez seulement le sous-domaine de votre réseau
        local à un hébergeur que local-cert sait piloter :
      </p>
      <ol>
        <li>
          Créez une zone <code>home.example.com</code> chez AWS Route53, OVHcloud, Gandi ou Google
          Cloud DNS.
        </li>
        <li>
          Dans le DNS GoDaddy de <code>example.com</code>, ajoutez un enregistrement{' '}
          <code>NS</code> par serveur de noms de cette zone, avec pour nom <code>home</code>.
        </li>
        <li>Déclarez le provider correspondant et ajoutez le domaine délégué.</li>
      </ol>

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
                <code>401 UNABLE_TO_AUTHENTICATE</code>
              </td>
              <td>Clé ou secret erroné, ou clé OTE utilisée en production.</td>
            </tr>
            <tr>
              <td>
                <code>403 ACCESS_DENIED</code>
              </td>
              <td>Le compte ne remplit pas la condition d&apos;accès à l&apos;API.</td>
            </tr>
            <tr>
              <td>
                <code>422</code> à l&apos;écriture
              </td>
              <td>Valeur refusée par GoDaddy (TTL, format) : le message précise le champ.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

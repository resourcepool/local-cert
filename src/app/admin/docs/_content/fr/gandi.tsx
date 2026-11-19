import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function Gandi() {
  return (
    <>
      <h1>Provider Gandi</h1>
      <p className="lead">
        local-cert pilote Gandi LiveDNS avec un Personal Access Token, que vous limitez aux
        domaines et aux droits strictement nécessaires.
      </p>

      <h2>1. Créer le token</h2>
      <ol>
        <li>
          Dans Gandi : <b>Organisations</b> → l&apos;organisation propriétaire des domaines →{' '}
          <b>Partage</b> → <b>Personal Access Tokens</b> → <b>Créer un token</b>. Adresse directe
          : <code>https://admin.gandi.net/organizations/account/pat</code>.
        </li>
        <li>
          <b>Nom</b> : <code>local-cert</code>. <b>Expiration</b> : la plus longue que vous
          acceptez — à l&apos;échéance, émissions et renouvellements s&apos;arrêtent.
        </li>
        <li>
          <b>Ressources</b> : restreignez aux domaines que local-cert doit gérer.
        </li>
        <li>
          <b>Permissions</b> : cochez <b>Gérer la configuration technique des domaines</b>. Les
          permissions de lecture associées se cochent d&apos;elles-mêmes.
        </li>
        <li>
          <b>Créer</b>, puis copiez le token : il n&apos;est affiché qu&apos;une fois.
        </li>
      </ol>
      <Callout kind="warn" title="Pas l'ancienne clé d'API">
        Les anciennes « clés d&apos;API » Gandi (en-tête <code>Apikey</code>) sont dépréciées et ne
        sont pas prises en charge : il faut un Personal Access Token.
      </Callout>

      <h2>2. Créer le provider</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Providers</Link> → <b>+ nouveau provider</b> →{' '}
          <b>Gandi</b>.
        </li>
        <li>Donnez un nom et collez le token.</li>
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
          Le domaine doit utiliser <b>LiveDNS</b> (serveurs <code>ns-*.gandi.net</code>). Un
          domaine enregistré chez Gandi mais servi par des serveurs de noms externes
          n&apos;apparaît pas dans la liste.
        </li>
        <li>
          <b>TTL minimal : 300 secondes.</b> local-cert relève toute valeur plus basse. Sans effet
          sur l&apos;émission des certificats.
        </li>
        <li>
          Pour changer de token à l&apos;approche de son expiration :{' '}
          <Link href="/admin/providers">Providers</Link> → <b>modifier</b>, collez le nouveau,{' '}
          <b>Tester</b>, <b>Enregistrer</b>.
        </li>
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
                <code>401</code>
              </td>
              <td>Token mal recopié, expiré ou supprimé.</td>
            </tr>
            <tr>
              <td>
                <code>403</code>
              </td>
              <td>
                Le token ne porte pas la permission de configuration technique, ou le domaine
                n&apos;est pas dans ses ressources.
              </td>
            </tr>
            <tr>
              <td>La liste des zones est vide</td>
              <td>Aucun domaine du périmètre du token n&apos;utilise LiveDNS.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

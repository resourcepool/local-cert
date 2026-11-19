import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function Domains() {
  return (
    <>
      <h1>Ajouter un domaine</h1>
      <p className="lead">
        Un domaine géré est un nom de base — <code>home.example.com</code> — sous lequel
        local-cert a le droit d&apos;émettre. Il s&apos;appuie sur une zone hébergée d&apos;un
        provider. L&apos;assistant de la page <Link href="/admin/domains">Domaines</Link> fait
        tout en trois écrans.
      </p>

      <h2>Avant de commencer</h2>
      <ul>
        <li>
          Un <Link href="/admin/docs/providers">provider</Link> enregistré, dont le test est
          au vert.
        </li>
        <li>
          Une zone <b>publique</b> chez cet hébergeur, qui fait autorité pour le nom. Let&apos;s Encrypt
          doit pouvoir lire l&apos;enregistrement de validation depuis Internet : une zone privée
          ne convient pas, même si vos hôtes, eux, restent privés.
        </li>
      </ul>
      <Callout title="Dédier une zone au LAN">
        Vous n&apos;êtes pas obligé d&apos;ouvrir votre zone principale. Créez une zone Route53
        pour <code>home.example.com</code> et déléguez-la depuis <code>example.com</code> avec
        quatre enregistrements <code>NS</code> : local-cert n&apos;aura de droits que sur ce
        sous-domaine, quel que soit l&apos;hébergeur de la zone parente.
      </Callout>

      <h2>1. Choisir le provider</h2>
      <p>
        <b>+ ajouter un domaine</b>, puis sélectionnez le provider. local-cert interroge le compte
        et affiche le nombre de zones visibles.
      </p>

      <h2>2. Choisir la zone</h2>
      <p>
        Les zones du compte sont listées avec leur identifiant. Une zone privée est grisée. Si une
        zone porte déjà un domaine géré, il est indiqué.
      </p>
      <ul>
        <li>
          <b>Nom de base</b> : par défaut le nom de la zone. Vous pouvez le restreindre à un
          sous-domaine (<code>lab.home.example.com</code> dans la zone{' '}
          <code>home.example.com</code>) : seuls les noms situés dessous pourront recevoir un
          certificat.
        </li>
        <li>
          <b>TTL par défaut</b> : durée de vie des enregistrements que local-cert publie. 60
          secondes conviennent.
        </li>
      </ul>

      <h2>3. Donner les droits, tester, ajouter</h2>
      <p>
        local-cert teste immédiatement ses droits sur la zone. S&apos;ils sont déjà là, il ne
        reste qu&apos;à confirmer. Sinon l&apos;écran affiche quoi faire :
      </p>
      <ol>
        <li>
          Dans la console AWS, ouvrez le rôle (ou l&apos;utilisateur) indiqué → onglet{' '}
          <b>Permissions</b>.
        </li>
        <li>
          Cliquez sur la politique <b>déjà existante</b>, <code>local-cert-route53</code> — celle
          créée avec le provider — puis <b>Edit</b> → onglet <b>JSON</b>. N&apos;ajoutez pas une
          seconde politique : c&apos;est celle-ci qu&apos;on fait évoluer.
        </li>
        <li>
          Remplacez tout le contenu par le document affiché, puis <b>Next</b> →{' '}
          <b>Save changes</b>. Il contient les zones déjà déclarées sur ce provider <b>plus</b> la
          nouvelle : rien n&apos;est retiré.
        </li>
        <li>
          Revenez dans l&apos;assistant et cliquez <b>Retester</b>.
        </li>
        <li>
          Quand toutes les lignes requises sont à <code>OK</code>, <b>Ajouter le domaine</b>.
        </li>
      </ol>

      <h3>Ajouter sans attendre : le statut « en attente »</h3>
      <p>
        Un hébergeur peut mettre quelques minutes à appliquer un changement de droits. Plutôt que
        de retester à la main, ajoutez le domaine alors que le test échoue encore (bouton{' '}
        <b>Ajouter en attente</b>) :
      </p>
      <ul>
        <li>
          le domaine est <b>en attente</b> : local-cert refait le test chaque minute, cinq fois, et
          le passe <b>actif</b> dès qu&apos;il réussit ;
        </li>
        <li>
          après cinq échecs il passe <b>en erreur</b>, avec le dernier refus affiché. Corrigez les
          droits, puis cliquez <b>relancer la vérification</b> : un nouveau cycle démarre ;
        </li>
        <li>
          tant qu&apos;il n&apos;est pas actif, le domaine ne reçoit ni certificat ni
          enregistrement : l&apos;API répond <code>409</code> et le serveur ACME{' '}
          <code>rejectedIdentifier</code>.
        </li>
      </ul>

      <Callout title="Hors AWS, cette étape est plus courte">
        Chez OVHcloud, Gandi, GoDaddy et Google Cloud, les droits sont portés par les identifiants
        du provider : il n&apos;y a pas de politique à coller, seulement le test. Celui-ci crée
        puis supprime un enregistrement TXT temporaire dans la zone. Les étapes ci-dessus et le
        tableau ci-dessous décrivent le cas AWS.
      </Callout>

      <h3>Ce que vérifie le test</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Appel</th>
              <th>Requis</th>
              <th>Sert à</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ListResourceRecordSets</code>
              </td>
              <td>oui</td>
              <td>lire la zone, et vérifier qu&apos;elle couvre le nom de base</td>
            </tr>
            <tr>
              <td>
                <code>GetHostedZone</code>
              </td>
              <td>oui</td>
              <td>trouver les serveurs de noms à interroger pendant la validation</td>
            </tr>
            <tr>
              <td>
                <code>GetChange</code>
              </td>
              <td>oui</td>
              <td>attendre la propagation d&apos;une écriture</td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code> (TXT)
              </td>
              <td>oui</td>
              <td>écrire l&apos;enregistrement de validation</td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code> (A)
              </td>
              <td>non</td>
              <td>publier l&apos;adresse d&apos;un hôte, si vous le demandez à l&apos;émission</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Le droit d&apos;écriture est sondé par la suppression d&apos;un enregistrement qui
        n&apos;existe pas : AWS vérifie l&apos;autorisation avant de constater qu&apos;il n&apos;y
        a rien à supprimer. <b>La zone n&apos;est jamais modifiée par le test.</b>
      </p>

      <h3>Si le test reste rouge</h3>
      <ul>
        <li>
          Attendez quelques secondes et retestez : IAM ne propage pas instantanément.
        </li>
        <li>
          Vérifiez que la politique a été collée sur l&apos;identité indiquée, et pas sur
          l&apos;utilisateur alors que le provider passe par un rôle.
        </li>
        <li>
          Si toutes les lignes échouent sur le même message, c&apos;est le provider lui-même :
          bouton <b>tester</b> dans <Link href="/admin/providers">Providers</Link>.
        </li>
        <li>
          Si un enregistrement <code>CAA</code> existe sur la zone, il doit autoriser{' '}
          <code>letsencrypt.org</code> — le test ne le vérifie pas, mais l&apos;émission échouera.
        </li>
      </ul>
      <p>
        <b>Ajouter quand même</b> enregistre un domaine dont le test échoue. Utile pour préparer
        une configuration ; aucune émission n&apos;aboutira tant que les droits manquent.
      </p>

      <h2>Ensuite</h2>
      <ul>
        <li>
          Donnez accès au domaine dans <Link href="/admin/keys">Clés &amp; droits</Link> : une clé
          d&apos;API avec ses droits, ou un identifiant EAB pour un client ACME.
        </li>
        <li>
          Émettez un premier certificat : <Link href="/admin/docs">Démarrage rapide</Link>.
        </li>
      </ul>

      <h2>Retirer un domaine</h2>
      <p>
        <b>retirer</b> est refusé tant que des certificats existent. <b>forcer</b> les révoque,
        nettoie la zone autant que possible, puis supprime le tout. Pensez ensuite à régénérer la
        politique du provider (bouton <b>politique</b>) et à la recoller dans AWS : la zone
        retirée n&apos;y figure plus.
      </p>
    </>
  );
}

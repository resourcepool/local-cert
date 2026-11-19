import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout } from '../../_lib/prose';

export default function Gcp() {
  return (
    <>
      <h1>Provider Google Cloud</h1>
      <p className="lead">
        local-cert pilote Cloud DNS en tant que compte de service, à partir de sa clé JSON. Un
        provider correspond à un projet Google Cloud.
      </p>

      <h2>Avant de commencer</h2>
      <ul>
        <li>
          L&apos;API <b>Cloud DNS</b> est activée sur le projet (<b>API et services</b> →{' '}
          <b>Bibliothèque</b> → Cloud DNS API).
        </li>
        <li>
          La zone est <b>publique</b>. Une zone privée est invisible pour Let&apos;s Encrypt.
        </li>
      </ul>

      <h2>1. Créer le compte de service</h2>
      <ol>
        <li>
          Console Google Cloud, projet qui contient vos zones → <b>IAM et administration</b> →{' '}
          <b>Comptes de service</b> → <b>Créer un compte de service</b>.
        </li>
        <li>
          <b>Nom</b> : <code>local-cert-dns</code>. <b>Créer et continuer</b>.
        </li>
        <li>
          <b>Rôle</b> : <b>Administrateur DNS</b> (<code>roles/dns.admin</code>).{' '}
          <b>Continuer</b>, puis <b>OK</b>.
        </li>
      </ol>
      <p>Ou en ligne de commande :</p>
      <CodeBlock
        title="gcloud"
        code={`PROJECT=mon-projet
gcloud iam service-accounts create local-cert-dns --project "$PROJECT"
gcloud projects add-iam-policy-binding "$PROJECT" \\
  --member "serviceAccount:local-cert-dns@$PROJECT.iam.gserviceaccount.com" \\
  --role roles/dns.admin`}
      />

      <h2>2. Créer la clé JSON</h2>
      <ol>
        <li>
          Ouvrez le compte de service → onglet <b>Clés</b> → <b>Ajouter une clé</b> →{' '}
          <b>Créer une clé</b> → <b>JSON</b>.
        </li>
        <li>Un fichier <code>.json</code> est téléchargé : c&apos;est le seul exemplaire.</li>
      </ol>
      <CodeBlock
        title="gcloud"
        code={`gcloud iam service-accounts keys create local-cert-dns.json \\
  --iam-account "local-cert-dns@$PROJECT.iam.gserviceaccount.com"`}
      />
      <Callout title="Création de clés bloquée ?">
        Certaines organisations interdisent les clés de compte de service (contrainte{' '}
        <code>iam.disableServiceAccountKeyCreation</code>). Il faut alors la faire lever pour ce
        projet par un administrateur de l&apos;organisation.
      </Callout>

      <h2>3. Créer le provider</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Providers</Link> → <b>+ nouveau provider</b> →{' '}
          <b>Google Cloud</b>.
        </li>
        <li>
          Donnez un nom et collez <b>tout le contenu</b> du fichier JSON. L&apos;ID du projet est
          lu dans la clé ; ne le renseignez que si les zones sont dans un autre projet.
        </li>
        <li>
          <b>Tester la connexion</b>, puis <b>Enregistrer</b>. Supprimez ensuite le fichier
          téléchargé.
        </li>
      </ol>

      <h2>4. Ajouter un domaine</h2>
      <p>
        <Link href="/admin/domains">Domaines</Link> → <b>+ ajouter un domaine</b> → ce provider →
        la zone. Le test crée puis supprime un enregistrement TXT temporaire.
      </p>

      <h2>À savoir</h2>
      <ul>
        <li>
          Le rôle <code>roles/dns.admin</code> porte sur toutes les zones du projet. Pour isoler
          une zone, placez-la dans un projet dédié, ou accordez le rôle au niveau de la zone
          plutôt que du projet (IAM de la zone gérée) en conservant au compte{' '}
          <code>roles/dns.reader</code> sur le projet pour la liste.
        </li>
        <li>
          Le domaine doit être délégué aux serveurs de noms indiqués par Cloud DNS pour la zone (
          <code>ns-cloud-*.googledomains.com</code>).
        </li>
        <li>
          Plusieurs projets : un provider par projet, chacun avec son compte de service — ou un
          seul compte de service auquel chaque projet accorde le rôle, déclaré en autant de
          providers avec des <b>ID de projet</b> différents.
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
                <code>invalid_grant</code>
              </td>
              <td>Clé supprimée ou compte de service désactivé ; horloge du serveur déréglée.</td>
            </tr>
            <tr>
              <td>
                <code>403 … Cloud DNS API has not been used</code>
              </td>
              <td>L&apos;API Cloud DNS n&apos;est pas activée sur le projet.</td>
            </tr>
            <tr>
              <td>
                <code>403 Forbidden</code>
              </td>
              <td>Le compte de service n&apos;a pas le rôle DNS sur ce projet.</td>
            </tr>
            <tr>
              <td>
                <code>The service account key is not valid JSON</code>
              </td>
              <td>Le fichier a été collé partiellement.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

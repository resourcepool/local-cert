import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import {
  PLACEHOLDER_ROLE_ARN,
  PLACEHOLDER_USER_ARN,
  assumePolicy,
  permissionsPolicy,
  trustPolicy,
} from '@/lib/dns/aws-policy';
import { Callout } from '../../_lib/prose';

const json = (doc: unknown) => JSON.stringify(doc, null, 2);
const EXAMPLE = { userArn: PLACEHOLDER_USER_ARN, roleArn: PLACEHOLDER_ROLE_ARN };

export default function AwsProvider() {
  return (
    <>
      <h1>Provider AWS</h1>
      <p className="lead">
        Un provider est une identité sur un compte AWS, que local-cert utilise pour lire et écrire
        dans Route53. Vous en créez un par compte — <code>aws-prod</code>,{' '}
        <code>aws-lab</code> — puis vous déclarez vos domaines dessus.
      </p>

      <h2>Le modèle</h2>
      <p>Trois objets côté AWS, chacun avec un rôle précis :</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Objet</th>
              <th>Rôle</th>
              <th>Ce qu&apos;il porte</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Utilisateur IAM</td>
              <td>l&apos;identité de local-cert</td>
              <td>une paire de clés, et rien d&apos;autre</td>
            </tr>
            <tr>
              <td>Rôle IAM</td>
              <td>ce que local-cert a le droit de faire</td>
              <td>la politique Route53, que vous faites évoluer</td>
            </tr>
            <tr>
              <td>Politique du rôle</td>
              <td>la liste des zones autorisées</td>
              <td>générée par local-cert, collée par vous</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        La clé stockée dans local-cert ne donne donc aucun droit par elle-même : elle permet
        seulement d&apos;assumer le rôle. Ajouter une zone, c&apos;est modifier la politique du
        rôle ; la clé ne change jamais.
      </p>
      <p>
        L&apos;assistant de la page <Link href="/admin/providers">Providers</Link> déroule ces
        étapes et génère chaque document avec vos vrais identifiants. Ce guide les détaille.
      </p>

      <h2>1. Créer l&apos;utilisateur IAM</h2>
      <ol>
        <li>
          Console AWS → <b>IAM</b> → <b>Users</b> → <b>Create user</b>.
        </li>
        <li>
          Nom : <code>local-cert</code>. Laissez décoché{' '}
          <i>Provide user access to the AWS Management Console</i>.
        </li>
        <li>
          Étape des permissions : <b>n&apos;attachez rien</b>. Terminez la création.
        </li>
        <li>
          Ouvrez l&apos;utilisateur → <b>Security credentials</b> → <b>Create access key</b> → cas
          d&apos;usage <i>Application running outside AWS</i>.
        </li>
        <li>
          Notez l&apos;<b>Access key ID</b> et la <b>Secret access key</b> : la seconde n&apos;est
          plus consultable ensuite.
        </li>
      </ol>

      <h2>2. Saisir la clé dans local-cert</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Providers</Link> → <b>+ nouveau provider</b>.
        </li>
        <li>
          Donnez un nom (<code>aws-prod</code>) et collez la paire de clés.
        </li>
        <li>
          <b>Vérifier la clé</b> : local-cert appelle <code>sts:GetCallerIdentity</code>, qui ne
          demande aucun droit, et affiche l&apos;ARN de l&apos;utilisateur. C&apos;est cet ARN qui
          sert à générer la suite.
        </li>
      </ol>
      <p>
        La clé secrète est chiffrée en base (AES-256-GCM avec <code>MASTER_KEY</code>) et
        n&apos;est jamais réaffichée ni renvoyée par l&apos;API.
      </p>

      <h2>3. Créer le rôle</h2>
      <ol>
        <li>
          <b>IAM</b> → <b>Roles</b> → <b>Create role</b> → <b>Custom trust policy</b>.
        </li>
        <li>
          Collez la <b>politique de confiance</b> affichée par l&apos;assistant. Elle n&apos;autorise
          que votre utilisateur à assumer le rôle :
        </li>
      </ol>
      <CodeBlock title="Politique de confiance (exemple)" code={json(trustPolicy(PLACEHOLDER_USER_ARN))} />
      <ol start={3}>
        <li>
          Étape des permissions : n&apos;ajoutez aucune politique gérée.
        </li>
        <li>
          Nom du rôle : <code>local-cert-dns</code>. Créez-le.
        </li>
        <li>
          Ouvrez le rôle → <b>Permissions</b> → <b>Add permissions</b> →{' '}
          <b>Create inline policy</b> → onglet <b>JSON</b>, et collez la{' '}
          <b>politique de droits</b> de l&apos;assistant. À ce stade elle ne contient que le
          nécessaire pour lister les zones :
        </li>
      </ol>
      <CodeBlock title="Politique de droits initiale" code={json(permissionsPolicy([], EXAMPLE))} />
      <ol start={6}>
        <li>
          Nommez la politique (<code>local-cert-route53</code>), enregistrez, puis copiez l&apos;
          <b>ARN du rôle</b> dans l&apos;assistant.
        </li>
      </ol>

      <h2>4. Tester et enregistrer</h2>
      <p>
        <b>Tester la connexion</b> enchaîne trois vérifications, chacune dépendant de la
        précédente :
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Vérification</th>
              <th>En cas d&apos;échec</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Paire de clés</td>
              <td>clé inconnue, désactivée ou mal recopiée</td>
            </tr>
            <tr>
              <td>Rôle (AssumeRole)</td>
              <td>
                ARN du rôle erroné, ou politique de confiance qui ne nomme pas le bon utilisateur
              </td>
            </tr>
            <tr>
              <td>Zones (ListHostedZones)</td>
              <td>politique de droits absente du rôle, ou pas encore propagée</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        IAM applique une modification en quelques secondes : un test lancé juste après un
        collage peut échouer une fois. Quand les trois lignes sont à <code>OK</code>,{' '}
        <b>Enregistrer</b>.
      </p>

      <h2>5. Ajouter des domaines</h2>
      <p>
        Le provider sait maintenant lister vos zones, mais n&apos;a encore le droit d&apos;écrire
        dans aucune. Ces droits s&apos;ajoutent zone par zone :{' '}
        <Link href="/admin/docs/domains">Ajouter un domaine</Link>. Une fois quelques zones
        déclarées, la politique du rôle ressemble à ceci :
      </p>
      <CodeBlock
        title="Politique de droits avec deux zones (exemple)"
        code={json(permissionsPolicy(['Z0123456ABCDEFGHIJK', 'Z0987654ZYXWVUTSRQP'], EXAMPLE))}
      />
      <p>
        Le bouton <b>politique</b> de chaque provider régénère ce document à tout moment à partir
        des domaines réellement déclarés.
      </p>

      <h2>Ce que la politique autorise</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Portée</th>
              <th>Pourquoi</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ListHostedZones</code>
              </td>
              <td>compte</td>
              <td>proposer la liste des zones ; AWS n&apos;accepte pas de la restreindre</td>
            </tr>
            <tr>
              <td>
                <code>GetChange</code>
              </td>
              <td>compte</td>
              <td>attendre qu&apos;une écriture soit propagée</td>
            </tr>
            <tr>
              <td>
                <code>GetHostedZone</code>, <code>ListResourceRecordSets</code>
              </td>
              <td>zones déclarées</td>
              <td>
                connaître les serveurs de noms à interroger, lister les enregistrements
              </td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code>
              </td>
              <td>zones déclarées, types TXT / A / AAAA, actions UPSERT / DELETE</td>
              <td>
                écrire le TXT de validation ; publier l&apos;adresse d&apos;un hôte si vous le
                demandez
              </td>
            </tr>
            <tr>
              <td>
                <code>iam:ListAccessKeys</code>, <code>DeleteAccessKey</code>,{' '}
                <code>ListUserPolicies</code>, <code>DeleteUserPolicy</code>,{' '}
                <code>DeleteUser</code>
              </td>
              <td>l&apos;utilisateur IAM du provider, lui seul</td>
              <td>
                facultatif : le supprimer au retrait du provider (
                <a href="#nettoyage">nettoyage</a>)
              </td>
            </tr>
            <tr>
              <td>
                <code>iam:ListRolePolicies</code>, <code>DeleteRolePolicy</code>
              </td>
              <td>le rôle du provider, lui seul</td>
              <td>facultatif : vider le rôle au retrait du provider</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout kind="warn" title="Si vous modifiez la politique à la main">
        Deux erreurs produisent un <code>AccessDenied</code> difficile à lire : retirer{' '}
        <code>TXT</code> des types autorisés (plus aucune émission possible), et écrire deux blocs{' '}
        <code>Condition</code> avec le même opérateur (le JSON ne garde que le dernier). Le plus
        sûr est de recoller le document généré en entier.
      </Callout>

      <h2>Plusieurs comptes AWS</h2>
      <p>Deux façons de couvrir un second compte, selon ce que vous voulez isoler.</p>
      <h3>Un provider par compte</h3>
      <p>
        Refaites les étapes 1 à 4 dans l&apos;autre compte et nommez le provider en conséquence.
        Chaque compte a sa propre clé ; en révoquer une n&apos;affecte pas l&apos;autre. C&apos;est
        la configuration la plus simple à raisonner.
      </p>
      <h3>Une seule clé, un rôle par compte</h3>
      <p>
        L&apos;utilisateur reste dans le compte A ; le rôle est créé dans le compte B, avec la
        même politique de confiance (l&apos;ARN de l&apos;utilisateur du compte A). Entre comptes,
        l&apos;utilisateur doit en plus être autorisé à assumer ce rôle. Attachez-lui cette
        politique inline :
      </p>
      <CodeBlock
        title="Politique de l'utilisateur, cas inter-comptes"
        code={json(assumePolicy(PLACEHOLDER_ROLE_ARN))}
      />
      <p>
        Créez ensuite un second provider avec la même paire de clés et l&apos;ARN du rôle du
        compte B.
      </p>

      <h2>Variantes</h2>
      <h3>Sans rôle</h3>
      <p>
        Décochez <i>Passer par un rôle IAM</i> dans l&apos;assistant : la politique de droits se
        colle alors directement sur l&apos;utilisateur. C&apos;est une étape de moins, au prix
        d&apos;une clé qui porte elle-même les droits.
      </p>
      <h3>Sans clé</h3>
      <p>
        Si local-cert tourne dans AWS ou dans un cluster avec IRSA, cochez{' '}
        <i>Pas de clé</i> : le provider utilise les credentials du processus (rôle d&apos;instance,
        rôle de pod, variables d&apos;environnement). Un rôle à assumer reste possible par-dessus.
      </p>

      <h2>Déclarer un provider par variables d&apos;environnement</h2>
      <p>
        Quand les credentials doivent venir du déploiement plutôt que de la base — secrets gérés
        par l&apos;orchestrateur, infrastructure décrite en code — un provider se déclare par
        variables. Tout est facultatif : sans aucune variable, les providers se gèrent uniquement
        depuis la console.
      </p>
      <CodeBlock
        title=".env"
        code={`PROVIDER_AWS_DEFAULT_NAME="Default AWS"
PROVIDER_AWS_DEFAULT_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_DEFAULT_SECRET_ACCESS_KEY=…
PROVIDER_AWS_DEFAULT_ROLE_ARN=arn:aws:iam::123456789012:role/local-cert-dns

# un second compte : même bloc, autre libellé
PROVIDER_AWS_PROD_NAME="aws-prod"
PROVIDER_AWS_PROD_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_PROD_SECRET_ACCESS_KEY=…`}
      />
      <ul>
        <li>
          <code>_NAME</code> déclare le provider ; c&apos;est la seule variable obligatoire du
          bloc. Le libellé (<code>DEFAULT</code>, <code>PROD</code>…) est libre.
        </li>
        <li>
          Sans paire de clés, le provider utilise les credentials du processus.{' '}
          <code>_ROLE_ARN</code> et <code>_REGION</code> sont facultatifs.
        </li>
        <li>
          Ces providers apparaissent dans la console avec la mention <i>environnement</i>. On peut
          les tester et générer leur politique, mais pas les modifier ni les retirer : cela se fait
          dans les variables, suivi d&apos;un redémarrage. Leur clé secrète n&apos;est jamais
          écrite en base.
        </li>
        <li>
          Le libellé <code>DEFAULT</code> a une particularité : les domaines déclarés avant
          l&apos;arrivée des providers y sont rattachés au démarrage.
        </li>
      </ul>

      <h2 id="nettoyage">Retirer un provider et nettoyer AWS</h2>
      <p>
        <Link href="/admin/providers">Providers</Link> → <b>retirer</b> efface le provider de
        local-cert. En cochant <b>Nettoyer aussi côté AWS</b>, le provider défait d&apos;abord ce
        que l&apos;assistant vous a fait créer :
      </p>
      <ol>
        <li>
          la session du rôle supprime l&apos;utilisateur IAM : ses clés d&apos;accès, ses
          politiques inline, puis l&apos;utilisateur ;
        </li>
        <li>elle supprime ensuite la politique du rôle lui-même.</li>
      </ol>
      <p>
        IAM ne permet pas à une identité de se supprimer entièrement : un rôle ne se supprime
        qu&apos;une fois vidé de ses politiques, et c&apos;est d&apos;elles que vient le droit de
        le faire. Il reste donc le rôle <code>local-cert-dns</code>, sans aucun droit et que plus
        personne ne peut assumer. La console affiche la commande pour le supprimer avec un compte
        administrateur :
      </p>
      <CodeBlock title="AWS CLI" code="aws iam delete-role --role-name local-cert-dns" />
      <ul>
        <li>
          Sans rôle, le provider ne peut que supprimer sa propre clé d&apos;accès ;
          l&apos;utilisateur reste, sans identifiant.
        </li>
        <li>
          Les droits correspondants sont les blocs <code>LocalCertRemove…</code> de la politique
          générée. Ils ne visent que l&apos;utilisateur et le rôle du provider et ne permettent
          que de supprimer : une clé volée pourrait couper local-cert, pas étendre ses droits.
          Retirez-les du document si vous ne voulez pas de cette option.
        </li>
        <li>
          Un provider créé avant cette option doit d&apos;abord recevoir la politique à jour
          (bouton <b>politique</b>). Si AWS refuse avant toute suppression, le provider est
          conservé.
        </li>
        <li>
          L&apos;option n&apos;est pas proposée quand un autre provider utilise le même
          utilisateur ou le même rôle, ni pour les providers déclarés par variables
          d&apos;environnement.
        </li>
        <li>
          Si l&apos;utilisateur a des politiques gérées attachées ou appartient à un groupe, IAM
          refuse sa suppression : le nettoyage s&apos;arrête là et liste ce qui reste à faire.
        </li>
      </ul>

      <h2>Rotation de la clé</h2>
      <ol>
        <li>
          Dans IAM, créez une <b>seconde</b> clé d&apos;accès sur l&apos;utilisateur.
        </li>
        <li>
          <Link href="/admin/providers">Providers</Link> → <b>modifier</b> →{' '}
          <i>Remplacer la paire de clés</i> → <b>Tester</b>, puis <b>Enregistrer</b>.
        </li>
        <li>Dans IAM, désactivez l&apos;ancienne clé, puis supprimez-la.</li>
      </ol>
      <p>Le rôle et sa politique ne sont pas concernés.</p>
    </>
  );
}

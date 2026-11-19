import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { getMessages } from '@/lib/i18n/server';
import { localizeProvider } from '@/lib/i18n/provider-text';
import { PROVIDER_INFO, PROVIDER_TYPES } from '@/lib/dns/provider-types';
import { Callout } from '../../_lib/prose';

export default async function Providers() {
  const messages = await getMessages();
  return (
    <>
      <h1>Providers DNS</h1>
      <p className="lead">
        Un provider est un compte chez l&apos;hébergeur de vos zones DNS, avec les identifiants qui
        permettent à local-cert d&apos;y écrire. C&apos;est par là que passe la preuve demandée par
        Let&apos;s Encrypt : un enregistrement TXT posé le temps de la validation.
      </p>

      <h2>Hébergeurs pris en charge</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Hébergeur</th>
              <th>Service</th>
              <th>Identifiants</th>
              <th>TTL minimal</th>
              <th>Guide</th>
            </tr>
          </thead>
          <tbody>
            {PROVIDER_TYPES.map((type) => {
              const info = localizeProvider(messages, PROVIDER_INFO[type]);
              return (
                <tr key={type}>
                  <td>{info.label}</td>
                  <td>{info.product}</td>
                  <td>
                    {type === 'aws'
                      ? 'clé IAM, rôle conseillé'
                      : info.fields
                          .filter((f) => f.required)
                          .map((f) => f.label)
                          .join(', ')}
                  </td>
                  <td>{info.minTtl} s</td>
                  <td>
                    <Link href={`/admin/docs/${info.docs}`}>ouvrir</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Le principe, quel que soit l&apos;hébergeur</h2>
      <ol>
        <li>
          Vous créez chez l&apos;hébergeur des identifiants <b>limités au DNS</b> — jamais ceux de
          votre compte principal.
        </li>
        <li>
          <Link href="/admin/providers">Providers</Link> → <b>+ nouveau provider</b> : vous
          choisissez l&apos;hébergeur, collez les identifiants, testez, enregistrez.
        </li>
        <li>
          <Link href="/admin/domains">Domaines</Link> → <b>+ ajouter un domaine</b> : local-cert
          liste les zones du compte, vous en choisissez une, il teste ses droits.
        </li>
      </ol>
      <p>
        Plusieurs providers du même hébergeur sont le cas normal : un par compte, ou un par
        périmètre de droits. Les secrets sont chiffrés en base (AES-256-GCM avec{' '}
        <code>MASTER_KEY</code>) et ne sont jamais réaffichés ni renvoyés par l&apos;API.
      </p>

      <h2>Ce qui diffère d&apos;un hébergeur à l&apos;autre</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>AWS Route53</th>
              <th>Les autres</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Droits</td>
              <td>par zone : une politique IAM à faire évoluer à chaque domaine ajouté</td>
              <td>portés par les identifiants : rien à modifier quand on ajoute un domaine</td>
            </tr>
            <tr>
              <td>Test des droits</td>
              <td>sans aucune écriture dans la zone</td>
              <td>
                un enregistrement TXT temporaire (<code>_localcert-preflight-…</code>) est créé
                puis supprimé
              </td>
            </tr>
            <tr>
              <td>Écritures</td>
              <td>atomiques, suivies jusqu&apos;à propagation</td>
              <td>enregistrement par enregistrement</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout title="TTL minimal">
        Gandi (300 s) et GoDaddy (600 s) refusent les TTL courts. local-cert relève alors
        silencieusement la valeur demandée. Cela n&apos;empêche pas l&apos;émission — la
        validation lit directement les serveurs faisant autorité — mais un enregistrement{' '}
        <code>A</code> modifié mettra ce temps-là à être vu partout.
      </Callout>

      <h2>Marquage de ce que local-cert crée</h2>
      <p>
        Chaque enregistrement publié à votre demande est accompagné d&apos;un TXT{' '}
        <code>_local-cert.&lt;nom&gt;</code> : c&apos;est ce qui permet de distinguer, dans la
        zone, ce qui vient de local-cert de ce qui existait déjà. La variable{' '}
        <code>TAG_RECORDS=0</code> le désactive.
      </p>

      <h2>Déclarer un provider par variables d&apos;environnement</h2>
      <p>
        Quand les identifiants doivent venir du déploiement plutôt que de la base, un provider se
        déclare par variables. C&apos;est facultatif, et le bloc se répète avec un autre libellé
        pour chaque compte.
      </p>
      <CodeBlock
        title=".env"
        code={`# PROVIDER_<HÉBERGEUR>_<LIBELLÉ>_NAME déclare le provider ; le reste, ses identifiants
PROVIDER_AWS_DEFAULT_NAME="Default AWS"
PROVIDER_AWS_DEFAULT_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_DEFAULT_SECRET_ACCESS_KEY=…
PROVIDER_AWS_DEFAULT_ROLE_ARN=arn:aws:iam::123456789012:role/local-cert-dns

PROVIDER_OVH_PERSO_NAME="ovh-perso"
PROVIDER_OVH_PERSO_ENDPOINT=ovh-eu
PROVIDER_OVH_PERSO_APPLICATION_KEY=…
PROVIDER_OVH_PERSO_APPLICATION_SECRET=…
PROVIDER_OVH_PERSO_CONSUMER_KEY=…

PROVIDER_GANDI_MAIN_NAME="gandi"
PROVIDER_GANDI_MAIN_TOKEN=…

PROVIDER_GODADDY_MAIN_NAME="godaddy"
PROVIDER_GODADDY_MAIN_API_KEY=…
PROVIDER_GODADDY_MAIN_API_SECRET=…

PROVIDER_GCP_MAIN_NAME="gcp"
PROVIDER_GCP_MAIN_SERVICE_ACCOUNT_JSON=<le JSON de la clé, ou son encodage base64>
PROVIDER_GCP_MAIN_PROJECT_ID=mon-projet   # facultatif`}
      />
      <ul>
        <li>
          Le libellé (<code>DEFAULT</code>, <code>PERSO</code>, <code>MAIN</code>…) est libre :
          lettres majuscules, chiffres et tirets bas.
        </li>
        <li>
          Ces providers apparaissent dans la console avec la mention <i>environnement</i>. On peut
          les tester, mais pas les modifier ni les retirer : cela se fait dans les variables, suivi
          d&apos;un redémarrage. Leurs secrets ne sont jamais écrits en base.
        </li>
        <li>
          Une déclaration incomplète est ignorée, avec un message au démarrage qui nomme la
          variable manquante.
        </li>
      </ul>
    </>
  );
}

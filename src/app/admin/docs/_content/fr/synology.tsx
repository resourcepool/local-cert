import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Synology({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Synology DSM</h1>
      <p className="lead">
        L&apos;assistant de certificats de DSM ne connaît que Let&apos;s Encrypt et exige que le
        NAS soit joignable depuis Internet. acme.sh, installé sur le NAS, obtient le certificat
        auprès de local-cert et l&apos;installe dans DSM avec son hook{' '}
        <code>synology_dsm</code>.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Préparer le NAS</h2>
      <ol>
        <li>
          <b>Panneau de configuration</b> → <b>Terminal &amp; SNMP</b> → activez SSH.
        </li>
        <li>
          Connectez-vous en SSH avec un compte administrateur, puis <code>sudo -i</code>.
        </li>
      </ol>
      <CodeBlock
        title="installer acme.sh hors du volume système"
        code={`mkdir -p /usr/local/share/acme.sh/webroot
cd /tmp && wget -O acme.sh.tar.gz https://github.com/acmesh-official/acme.sh/archive/master.tar.gz
tar xzf acme.sh.tar.gz && cd acme.sh-master
./acme.sh --install --nocron --home /usr/local/share/acme.sh -m ${EX.email}
cd /usr/local/share/acme.sh`}
      />

      <h2>2. Compte et émission</h2>
      <CodeBlock
        title="acme.sh"
        code={`./acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac}

./acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /usr/local/share/acme.sh/webroot`}
      />
      <p>
        Le dossier webroot reste vide et n&apos;est servi par rien : local-cert ne vient pas lire
        le challenge. Le NAS n&apos;a besoin d&apos;aucune ouverture de port.
      </p>

      <h2>3. Installer dans DSM</h2>
      <CodeBlock
        title="acme.sh — hook synology_dsm"
        code={`export SYNO_SCHEME=http
export SYNO_HOSTNAME=localhost
export SYNO_PORT=5000
export SYNO_USERNAME='un-compte-admin'
export SYNO_PASSWORD='son-mot-de-passe'
export SYNO_CERTIFICATE='local-cert'   # description du certificat dans DSM
export SYNO_CREATE=1                    # le créer s'il n'existe pas

./acme.sh --deploy -d ${EX.host} --deploy-hook synology_dsm`}
      />
      <p>
        Le certificat apparaît dans <b>Panneau de configuration</b> → <b>Sécurité</b> →{' '}
        <b>Certificat</b>. Affectez-le aux services voulus avec <b>Paramètres</b>.
      </p>
      <Callout kind="warn" title="Compte et double authentification">
        Le hook se connecte à DSM avec ce compte. Créez un administrateur dédié, sans double
        authentification, ou utilisez les variables prévues pour l&apos;OTP par les versions
        récentes d&apos;acme.sh. Les noms de variables ont changé au fil des versions (
        <code>SYNO_Username</code> → <code>SYNO_USERNAME</code>) : si le hook ne les voit pas,
        consultez l&apos;en-tête de <code>deploy/synology_dsm.sh</code>.
      </Callout>

      <h2>4. Renouvellement</h2>
      <p>
        <b>Panneau de configuration</b> → <b>Planificateur de tâches</b> → <b>Créer</b> →{' '}
        <b>Tâche planifiée</b> → <b>Script défini par l&apos;utilisateur</b>, utilisateur{' '}
        <code>root</code>, tous les jours :
      </p>
      <CodeBlock
        title="script"
        code={`/usr/local/share/acme.sh/acme.sh --cron --home /usr/local/share/acme.sh`}
      />
      <p>
        acme.sh ne renouvelle qu&apos;à l&apos;approche de l&apos;échéance, puis rejoue le
        déploiement dans DSM avec les réglages mémorisés.
      </p>
    </>
  );
}

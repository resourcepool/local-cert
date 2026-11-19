import { CodeBlock } from '@/components/ui';
import { EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Apache({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Apache httpd</h1>
      <p className="lead">
        Le module <code>mod_md</code>, livré avec Apache 2.4, gère ACME directement dans le
        serveur. L&apos;EAB est pris en charge à partir d&apos;Apache 2.4.52.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Activer les modules</h2>
      <CodeBlock title="Debian / Ubuntu" code={`a2enmod md ssl && systemctl restart apache2`} />

      <h2>2. Configurer</h2>
      <CodeBlock
        title="/etc/apache2/conf-available/local-cert.conf"
        code={`MDCertificateAuthority   ${ctx.directory}
MDCertificateAgreement   accepted
MDContactEmail           ${EX.email}
MDExternalAccountBinding ${EX.kid} ${EX.hmac}
MDCAChallenges           http-01

MDomain ${EX.host}

<VirtualHost *:443>
    ServerName ${EX.host}
    SSLEngine on
    # pas de SSLCertificateFile : mod_md fournit le certificat
    ProxyPass        / http://192.168.1.50:5000/
    ProxyPassReverse / http://192.168.1.50:5000/
</VirtualHost>

<VirtualHost *:80>
    ServerName ${EX.host}
</VirtualHost>`}
      />
      <CodeBlock title="activer" code={`a2enconf local-cert && systemctl reload apache2`} />

      <h2>3. Laisser faire, puis recharger</h2>
      <p>
        mod_md obtient le certificat en arrière-plan, puis attend un rechargement pour
        l&apos;activer. Suivez l&apos;avancement dans le journal d&apos;erreurs ; quand il annonce
        que le certificat est prêt :
      </p>
      <CodeBlock title="recharger" code={`systemctl reload apache2`} />
      <p>
        Les renouvellements suivent le même schéma : obtention automatique, activation au
        rechargement suivant. Un rechargement quotidien par cron suffit.
      </p>

      <h2>À savoir</h2>
      <ul>
        <li>
          Pour ne pas écrire la clé HMAC dans la configuration,{' '}
          <code>MDExternalAccountBinding</code> accepte aussi le chemin d&apos;un fichier JSON{' '}
          <code>{'{"kid": "…", "hmac": "…"}'}</code>, lisible par root uniquement.
        </li>
        <li>
          Si mod_md gère déjà des domaines publics chez Let&apos;s Encrypt, placez ces directives
          dans un bloc <code>&lt;MDomain {EX.host}&gt; … &lt;/MDomain&gt;</code> pour ne les
          appliquer qu&apos;aux noms internes.
        </li>
      </ul>
    </>
  );
}

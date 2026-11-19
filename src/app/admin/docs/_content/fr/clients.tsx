import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Clients({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>certbot, acme.sh, lego</h1>
      <p className="lead">
        Les trois clients en ligne de commande. Ils suffisent à équiper n&apos;importe quelle
        machine, et la plupart des intégrations des autres guides reposent sur l&apos;un d&apos;eux.
      </p>
      <EabValues ctx={ctx} />

      <Callout title="Le challenge n'est jamais récupéré">
        local-cert ne vient pas lire la réponse HTTP-01. Vous pouvez donc utiliser le mode{' '}
        <b>webroot</b> vers un dossier quelconque, même s&apos;il n&apos;est servi par aucun
        serveur web : c&apos;est le plus simple quand le port 80 est déjà occupé.
      </Callout>

      <h2>certbot</h2>
      <p>Port 80 libre sur la machine : mode autonome.</p>
      <CodeBlock
        title="certbot — standalone"
        code={`certbot certonly --standalone -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} \\
  --email ${EX.email} --agree-tos --no-eff-email`}
      />
      <p>Port 80 occupé : mode webroot, vers un dossier vide.</p>
      <CodeBlock
        title="certbot — webroot"
        code={`mkdir -p /var/lib/letsencrypt/webroot
certbot certonly --webroot -w /var/lib/letsencrypt/webroot -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} \\
  --email ${EX.email} --agree-tos --no-eff-email \\
  --deploy-hook "systemctl reload nginx"`}
      />
      <p>
        Les fichiers arrivent dans <code>/etc/letsencrypt/live/{EX.host}/</code>. Le serveur et
        l&apos;EAB sont mémorisés dans le fichier de renouvellement : le timer{' '}
        <code>certbot renew</code> installé par le paquet renouvelle sans autre réglage. Vérifiez
        avec <code>certbot renew --dry-run</code>.
      </p>

      <h2>acme.sh</h2>
      <p>L&apos;enregistrement du compte est une étape séparée, faite une fois par machine.</p>
      <CodeBlock
        title="acme.sh"
        code={`# 1. compte, avec l'EAB
acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} -m ${EX.email}

# 2. émission (webroot vers un dossier vide)
mkdir -p /var/lib/acme-webroot
acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /var/lib/acme-webroot

# 3. installation des fichiers et commande de rechargement
acme.sh --install-cert -d ${EX.host} \\
  --key-file       /etc/ssl/private/${EX.host}.key \\
  --fullchain-file /etc/ssl/certs/${EX.host}.pem \\
  --reloadcmd      "systemctl reload nginx"`}
      />
      <p>
        Avec le port 80 libre, remplacez <code>-w …</code> par <code>--standalone</code> (
        <code>socat</code> requis). Le renouvellement passe par la tâche cron installée par
        acme.sh ; le dossier webroot doit donc exister durablement, d&apos;où un chemin hors de{' '}
        <code>/tmp</code>.
      </p>

      <h2>lego</h2>
      <CodeBlock
        title="lego"
        code={`lego --server ${ctx.directory} \\
  --eab --kid ${EX.kid} --hmac ${EX.hmac} \\
  --email ${EX.email} --accept-tos \\
  --http --domains ${EX.host} \\
  run`}
      />
      <p>
        Les fichiers arrivent dans <code>./.lego/certificates/</code>. lego n&apos;installe pas de
        tâche planifiée : programmez vous-même la même commande terminée par{' '}
        <code>renew --days 30</code>. Avec le port 80 occupé, ajoutez{' '}
        <code>--http.webroot /var/lib/acme-webroot</code>.
      </p>

      <h2>Vérifier</h2>
      <CodeBlock
        title="openssl"
        code={`openssl x509 -in /etc/letsencrypt/live/${EX.host}/fullchain.pem -noout -issuer -subject -enddate`}
      />
      <p>
        L&apos;émetteur doit être Let&apos;s Encrypt (ou <i>(STAGING)</i> tant que local-cert est
        en environnement de test). Le certificat apparaît aussi dans{' '}
        <Link href="/admin/certificates">Certificats</Link>.
      </p>
    </>
  );
}

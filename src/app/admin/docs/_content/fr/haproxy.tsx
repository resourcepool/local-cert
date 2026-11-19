import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Haproxy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>HAProxy</h1>
      <p className="lead">
        La voie éprouvée : acme.sh obtient le certificat et son hook <code>haproxy</code> assemble
        le fichier PEM que HAProxy attend, puis recharge le service.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Compte et émission</h2>
      <CodeBlock
        title="acme.sh"
        code={`acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} -m ${EX.email}

mkdir -p /var/lib/acme-webroot
acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /var/lib/acme-webroot`}
      />
      <p>
        Le dossier webroot n&apos;a pas à être servi par HAProxy : local-cert ne vient pas lire le
        challenge.
      </p>

      <h2>2. Déploiement vers HAProxy</h2>
      <CodeBlock
        title="acme.sh — hook haproxy"
        code={`export DEPLOY_HAPROXY_PEM_PATH=/etc/haproxy/certs
export DEPLOY_HAPROXY_RELOAD="systemctl reload haproxy"
acme.sh --deploy -d ${EX.host} --deploy-hook haproxy`}
      />
      <p>
        Le hook écrit <code>/etc/haproxy/certs/{EX.host}.pem</code> (certificat, chaîne et clé
        réunis). Les deux variables sont mémorisées : chaque renouvellement par la tâche cron
        d&apos;acme.sh redéploie et recharge.
      </p>

      <h2>3. Le frontend</h2>
      <CodeBlock
        title="/etc/haproxy/haproxy.cfg (extrait)"
        code={`frontend https
    bind :443 ssl crt /etc/haproxy/certs/
    http-request set-header X-Forwarded-Proto https
    use_backend nas if { hdr(host) -i ${EX.host} }

backend nas
    server nas 192.168.1.50:5000`}
      />

      <Callout title="ACME natif de HAProxy">
        HAProxy 3.2 et suivants embarquent un client ACME. Vérifiez dans la documentation de votre
        version qu&apos;il prend en charge l&apos;External Account Binding avant de vous en servir
        avec local-cert ; sans EAB, l&apos;enregistrement est refusé.
      </Callout>
    </>
  );
}

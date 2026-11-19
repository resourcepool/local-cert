import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Haproxy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>HAProxy</h1>
      <p className="lead">
        La strada collaudata: acme.sh ottiene il certificato e il suo hook <code>haproxy</code>{' '}
        assembla il file PEM atteso da HAProxy, quindi ricarica il servizio.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Account ed emissione</h2>
      <CodeBlock
        title="acme.sh"
        code={`acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} -m ${EX.email}

mkdir -p /var/lib/acme-webroot
acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /var/lib/acme-webroot`}
      />
      <p>
        La cartella webroot non deve essere servita da HAProxy: local-cert non legge la
        challenge.
      </p>

      <h2>2. Distribuzione verso HAProxy</h2>
      <CodeBlock
        title="acme.sh — hook haproxy"
        code={`export DEPLOY_HAPROXY_PEM_PATH=/etc/haproxy/certs
export DEPLOY_HAPROXY_RELOAD="systemctl reload haproxy"
acme.sh --deploy -d ${EX.host} --deploy-hook haproxy`}
      />
      <p>
        L&apos;hook scrive <code>/etc/haproxy/certs/{EX.host}.pem</code> (certificato, catena e
        chiave riuniti). Le due variabili sono memorizzate: ogni rinnovo eseguito dal job cron di
        acme.sh ridistribuisce e ricarica.
      </p>

      <h2>3. Il frontend</h2>
      <CodeBlock
        title="/etc/haproxy/haproxy.cfg (estratto)"
        code={`frontend https
    bind :443 ssl crt /etc/haproxy/certs/
    http-request set-header X-Forwarded-Proto https
    use_backend nas if { hdr(host) -i ${EX.host} }

backend nas
    server nas 192.168.1.50:5000`}
      />

      <Callout title="ACME nativo di HAProxy">
        HAProxy 3.2 e successivi includono un client ACME. Verificare nella documentazione della
        propria versione che supporti l&apos;External Account Binding prima di usarlo con
        local-cert; senza EAB, la registrazione viene rifiutata.
      </Callout>
    </>
  );
}

import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Haproxy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>HAProxy</h1>
      <p className="lead">
        The proven route: acme.sh obtains the certificate and its <code>haproxy</code> hook
        assembles the PEM file HAProxy expects, then reloads the service.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Account and issuance</h2>
      <CodeBlock
        title="acme.sh"
        code={`acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} -m ${EX.email}

mkdir -p /var/lib/acme-webroot
acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /var/lib/acme-webroot`}
      />
      <p>
        The webroot folder doesn&apos;t have to be served by HAProxy: local-cert never reads the
        challenge.
      </p>

      <h2>2. Deploy to HAProxy</h2>
      <CodeBlock
        title="acme.sh — haproxy hook"
        code={`export DEPLOY_HAPROXY_PEM_PATH=/etc/haproxy/certs
export DEPLOY_HAPROXY_RELOAD="systemctl reload haproxy"
acme.sh --deploy -d ${EX.host} --deploy-hook haproxy`}
      />
      <p>
        The hook writes <code>/etc/haproxy/certs/{EX.host}.pem</code> (certificate, chain and key
        combined). Both variables are remembered: every renewal run by acme.sh&apos;s cron job
        redeploys and reloads.
      </p>

      <h2>3. The frontend</h2>
      <CodeBlock
        title="/etc/haproxy/haproxy.cfg (excerpt)"
        code={`frontend https
    bind :443 ssl crt /etc/haproxy/certs/
    http-request set-header X-Forwarded-Proto https
    use_backend nas if { hdr(host) -i ${EX.host} }

backend nas
    server nas 192.168.1.50:5000`}
      />

      <Callout title="HAProxy's native ACME">
        HAProxy 3.2 and later ship an ACME client. Check in your version&apos;s documentation that
        it supports External Account Binding before using it with local-cert; without EAB,
        registration is refused.
      </Callout>
    </>
  );
}

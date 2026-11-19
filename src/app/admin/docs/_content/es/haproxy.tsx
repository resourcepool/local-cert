import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Haproxy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>HAProxy</h1>
      <p className="lead">
        La vía contrastada: acme.sh obtiene el certificado y su hook <code>haproxy</code> ensambla
        el archivo PEM que espera HAProxy y después recarga el servicio.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Cuenta y emisión</h2>
      <CodeBlock
        title="acme.sh"
        code={`acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} -m ${EX.email}

mkdir -p /var/lib/acme-webroot
acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /var/lib/acme-webroot`}
      />
      <p>
        HAProxy no tiene por qué servir la carpeta webroot: local-cert no va a leer el desafío.
      </p>

      <h2>2. Despliegue en HAProxy</h2>
      <CodeBlock
        title="acme.sh — hook haproxy"
        code={`export DEPLOY_HAPROXY_PEM_PATH=/etc/haproxy/certs
export DEPLOY_HAPROXY_RELOAD="systemctl reload haproxy"
acme.sh --deploy -d ${EX.host} --deploy-hook haproxy`}
      />
      <p>
        El hook escribe <code>/etc/haproxy/certs/{EX.host}.pem</code> (certificado, cadena y clave
        reunidos). Las dos variables se memorizan: cada renovación mediante la tarea cron de
        acme.sh vuelve a desplegar y recarga.
      </p>

      <h2>3. El frontend</h2>
      <CodeBlock
        title="/etc/haproxy/haproxy.cfg (extracto)"
        code={`frontend https
    bind :443 ssl crt /etc/haproxy/certs/
    http-request set-header X-Forwarded-Proto https
    use_backend nas if { hdr(host) -i ${EX.host} }

backend nas
    server nas 192.168.1.50:5000`}
      />

      <Callout title="ACME nativo de HAProxy">
        HAProxy 3.2 y posteriores incorporan un cliente ACME. Compruebe en la documentación de su
        versión que admite External Account Binding antes de usarlo con local-cert; sin EAB, el
        registro se rechaza.
      </Callout>
    </>
  );
}

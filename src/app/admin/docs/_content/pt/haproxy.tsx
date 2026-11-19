import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Haproxy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>HAProxy</h1>
      <p className="lead">
        A via comprovada: o acme.sh obtém o certificado e o seu hook <code>haproxy</code> monta o
        ficheiro PEM que o HAProxy espera e depois recarrega o serviço.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Conta e emissão</h2>
      <CodeBlock
        title="acme.sh"
        code={`acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} -m ${EX.email}

mkdir -p /var/lib/acme-webroot
acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /var/lib/acme-webroot`}
      />
      <p>
        A pasta webroot não precisa de ser servida pelo HAProxy: o local-cert não vai ler o
        desafio.
      </p>

      <h2>2. Implementação no HAProxy</h2>
      <CodeBlock
        title="acme.sh — hook haproxy"
        code={`export DEPLOY_HAPROXY_PEM_PATH=/etc/haproxy/certs
export DEPLOY_HAPROXY_RELOAD="systemctl reload haproxy"
acme.sh --deploy -d ${EX.host} --deploy-hook haproxy`}
      />
      <p>
        O hook escreve <code>/etc/haproxy/certs/{EX.host}.pem</code> (certificado, cadeia e chave
        reunidos). As duas variáveis ficam memorizadas: cada renovação feita pela tarefa cron do
        acme.sh volta a implementar e recarrega.
      </p>

      <h2>3. O frontend</h2>
      <CodeBlock
        title="/etc/haproxy/haproxy.cfg (excerto)"
        code={`frontend https
    bind :443 ssl crt /etc/haproxy/certs/
    http-request set-header X-Forwarded-Proto https
    use_backend nas if { hdr(host) -i ${EX.host} }

backend nas
    server nas 192.168.1.50:5000`}
      />

      <Callout title="ACME nativo do HAProxy">
        O HAProxy 3.2 e posteriores integram um cliente ACME. Verifique na documentação da sua
        versão se suporta o External Account Binding antes de o utilizar com o local-cert; sem
        EAB, o registo é recusado.
      </Callout>
    </>
  );
}

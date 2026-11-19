import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Caddy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Caddy</h1>
      <p className="lead">
        O Caddy obtém os seus certificados sozinho. Dois ajustes bastam para o levar a usar o
        local-cert em vez do Let&apos;s Encrypt diretamente.
      </p>
      <EabValues ctx={ctx} />

      <h2>Para todos os sites</h2>
      <p>No bloco de opções globais, no topo do Caddyfile:</p>
      <CodeBlock
        title="Caddyfile"
        code={`{
	email ${EX.email}
	acme_ca ${ctx.directory}
	acme_eab {
		key_id ${EX.kid}
		mac_key ${EX.hmac}
	}
}

${EX.host} {
	reverse_proxy 192.168.1.50:5000
}`}
      />

      <h2>Para um único site</h2>
      <p>
        Se o Caddy servir também sites públicos que devam continuar no Let&apos;s Encrypt, declare
        o emissor no site em causa:
      </p>
      <CodeBlock
        title="Caddyfile"
        code={`${EX.host} {
	tls {
		issuer acme {
			dir ${ctx.directory}
			eab ${EX.kid} ${EX.hmac}
			disable_tlsalpn_challenge
		}
	}
	reverse_proxy 192.168.1.50:5000
}`}
      />

      <h2>A ter em conta</h2>
      <ul>
        <li>
          O Caddy só pede certificado para um nome de domínio verdadeiro. Um nome em{' '}
          <code>.local</code>, <code>.internal</code> ou um endereço IP recebe um certificado da
          sua CA interna, sem passar pelo local-cert.
        </li>
        <li>
          O Caddy tenta TLS-ALPN-01 e HTTP-01; o local-cert só propõe HTTP-01, e o Caddy recorre a
          ele por si próprio. <code>disable_tlsalpn_challenge</code> apenas evita a tentativa.
        </li>
        <li>
          Após uma mudança de CA, recarregue (<code>caddy reload</code>). Os certificados já
          obtidos continuam a ser usados até à sua renovação.
        </li>
      </ul>
      <Callout title="Caddy num contentor">
        Conserve o volume <code>/data</code>: contém a conta ACME e os certificados. Sem ele, cada
        reinício regista uma nova conta e volta a pedir tudo.
      </Callout>
    </>
  );
}

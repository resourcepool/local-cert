import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Caddy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Caddy</h1>
      <p className="lead">
        Caddy obtiene sus certificados por sí solo. Bastan dos ajustes para que utilice
        local-cert en lugar de Let&apos;s Encrypt directamente.
      </p>
      <EabValues ctx={ctx} />

      <h2>Para todos los sitios</h2>
      <p>En el bloque de opciones globales, al principio del Caddyfile:</p>
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

      <h2>Para un solo sitio</h2>
      <p>
        Si Caddy también sirve sitios públicos que deben seguir con Let&apos;s Encrypt, declare
        el emisor en el sitio correspondiente:
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

      <h2>Conviene saber</h2>
      <ul>
        <li>
          Caddy solo solicita certificado para un nombre de dominio real. Un nombre en{' '}
          <code>.local</code>, <code>.internal</code> o una dirección IP recibe un certificado de
          su CA interna, sin pasar por local-cert.
        </li>
        <li>
          Caddy prueba TLS-ALPN-01 y HTTP-01; local-cert solo ofrece HTTP-01 y Caddy recurre a él
          por sí mismo. <code>disable_tlsalpn_challenge</code> solo evita el intento.
        </li>
        <li>
          Tras cambiar de CA, recargue (<code>caddy reload</code>). Los certificados ya obtenidos
          se siguen usando hasta su renovación.
        </li>
      </ul>
      <Callout title="Caddy en contenedor">
        Conserve el volumen <code>/data</code>: contiene la cuenta ACME y los certificados. Sin
        él, cada reinicio registra una cuenta nueva y vuelve a pedirlo todo.
      </Callout>
    </>
  );
}

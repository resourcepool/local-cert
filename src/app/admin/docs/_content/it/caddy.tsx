import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Caddy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Caddy</h1>
      <p className="lead">
        Caddy ottiene i certificati da solo. Bastano due impostazioni per fargli usare local-cert
        anziché Let&apos;s Encrypt direttamente.
      </p>
      <EabValues ctx={ctx} />

      <h2>Per tutti i siti</h2>
      <p>Nel blocco delle opzioni globali, in testa al Caddyfile:</p>
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

      <h2>Per un solo sito</h2>
      <p>
        Se Caddy serve anche siti pubblici che devono restare su Let&apos;s Encrypt, dichiarare
        l&apos;emittente nel sito interessato:
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

      <h2>Da sapere</h2>
      <ul>
        <li>
          Caddy richiede un certificato solo per un vero nome di dominio. Un nome in{' '}
          <code>.local</code>, <code>.internal</code> o un indirizzo IP riceve un certificato dalla
          propria CA interna, senza passare da local-cert.
        </li>
        <li>
          Caddy prova TLS-ALPN-01 e HTTP-01; local-cert propone solo HTTP-01, e Caddy vi ripiega
          da solo. <code>disable_tlsalpn_challenge</code> evita soltanto il tentativo.
        </li>
        <li>
          Dopo un cambio di CA, ricaricare (<code>caddy reload</code>). I certificati già ottenuti
          continuano a essere usati fino al loro rinnovo.
        </li>
      </ul>
      <Callout title="Caddy in un container">
        Conservare il volume <code>/data</code>: contiene l&apos;account ACME e i certificati.
        Senza di esso, a ogni riavvio viene registrato un nuovo account e viene richiesto tutto da
        capo.
      </Callout>
    </>
  );
}

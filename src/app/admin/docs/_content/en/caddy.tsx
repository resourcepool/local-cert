import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Caddy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Caddy</h1>
      <p className="lead">
        Caddy obtains its certificates on its own. Two settings are enough to make it use
        local-cert instead of Let&apos;s Encrypt directly.
      </p>
      <EabValues ctx={ctx} />

      <h2>For all sites</h2>
      <p>In the global options block, at the top of the Caddyfile:</p>
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

      <h2>For a single site</h2>
      <p>
        If Caddy also serves public sites that must stay with Let&apos;s Encrypt, declare the
        issuer in the relevant site:
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

      <h2>Good to know</h2>
      <ul>
        <li>
          Caddy only requests a certificate for a real domain name. A <code>.local</code> or{' '}
          <code>.internal</code> name, or an IP address, gets a certificate from its internal CA,
          without going through local-cert.
        </li>
        <li>
          Caddy tries TLS-ALPN-01 and HTTP-01; local-cert only offers HTTP-01, and Caddy falls back
          to it on its own. <code>disable_tlsalpn_challenge</code> just skips the attempt.
        </li>
        <li>
          After changing CA, reload (<code>caddy reload</code>). Certificates already obtained
          keep being used until they are renewed.
        </li>
      </ul>
      <Callout title="Caddy in a container">
        Keep the <code>/data</code> volume: it holds the ACME account and the certificates. Without
        it, every restart registers a new account and requests everything again.
      </Callout>
    </>
  );
}

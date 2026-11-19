import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Caddy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Caddy</h1>
      <p className="lead">
        Caddy besorgt seine Zertifikate von selbst. Zwei Einstellungen genügen, damit es
        local-cert statt direkt Let&apos;s Encrypt verwendet.
      </p>
      <EabValues ctx={ctx} />

      <h2>Für alle Sites</h2>
      <p>Im Block der globalen Optionen am Anfang des Caddyfile:</p>
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

      <h2>Für eine einzelne Site</h2>
      <p>
        Bedient Caddy auch öffentliche Sites, die bei Let&apos;s Encrypt bleiben sollen,
        deklarieren Sie den Aussteller in der betreffenden Site:
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

      <h2>Wissenswertes</h2>
      <ul>
        <li>
          Caddy fordert nur für einen echten Domainnamen ein Zertifikat an. Ein Name auf{' '}
          <code>.local</code>, <code>.internal</code> oder eine IP-Adresse erhält ein Zertifikat
          von seiner internen CA, ohne local-cert zu verwenden.
        </li>
        <li>
          Caddy versucht TLS-ALPN-01 und HTTP-01; local-cert bietet nur HTTP-01 an, worauf Caddy
          von selbst ausweicht. <code>disable_tlsalpn_challenge</code> erspart lediglich den
          Versuch.
        </li>
        <li>
          Laden Sie nach einem CA-Wechsel neu (<code>caddy reload</code>). Bereits erhaltene
          Zertifikate bleiben bis zu ihrer Erneuerung in Gebrauch.
        </li>
      </ul>
      <Callout title="Caddy im Container">
        Behalten Sie das Volume <code>/data</code>: Es enthält das ACME-Konto und die
        Zertifikate. Ohne es registriert sich Caddy bei jedem Neustart mit einem neuen Konto und
        fordert alles erneut an.
      </Callout>
    </>
  );
}

import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Caddy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Caddy</h1>
      <p className="lead">
        Caddy obtient ses certificats tout seul. Deux réglages suffisent à lui faire utiliser
        local-cert plutôt que Let&apos;s Encrypt directement.
      </p>
      <EabValues ctx={ctx} />

      <h2>Pour tous les sites</h2>
      <p>Dans le bloc d&apos;options globales, en tête du Caddyfile :</p>
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

      <h2>Pour un seul site</h2>
      <p>
        Si Caddy sert aussi des sites publics qui doivent rester chez Let&apos;s Encrypt, déclarez
        l&apos;émetteur dans le site concerné :
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

      <h2>À savoir</h2>
      <ul>
        <li>
          Caddy ne demande de certificat que pour un vrai nom de domaine. Un nom en{' '}
          <code>.local</code>, <code>.internal</code> ou une adresse IP reçoit un certificat de sa
          CA interne, sans passer par local-cert.
        </li>
        <li>
          Caddy essaie TLS-ALPN-01 et HTTP-01 ; local-cert ne propose que HTTP-01, Caddy s&apos;y
          rabat de lui-même. <code>disable_tlsalpn_challenge</code> évite juste l&apos;essai.
        </li>
        <li>
          Après un changement de CA, rechargez (<code>caddy reload</code>). Les certificats déjà
          obtenus restent utilisés jusqu&apos;à leur renouvellement.
        </li>
      </ul>
      <Callout title="Caddy en conteneur">
        Conservez le volume <code>/data</code> : il contient le compte ACME et les certificats.
        Sans lui, chaque redémarrage réenregistre un compte et redemande tout.
      </Callout>
    </>
  );
}

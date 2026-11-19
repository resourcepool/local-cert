import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Haproxy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>HAProxy</h1>
      <p className="lead">
        Der bewährte Weg: acme.sh besorgt das Zertifikat, und sein Hook <code>haproxy</code> setzt
        die von HAProxy erwartete PEM-Datei zusammen und lädt den Dienst neu.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Konto und Ausstellung</h2>
      <CodeBlock
        title="acme.sh"
        code={`acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} -m ${EX.email}

mkdir -p /var/lib/acme-webroot
acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /var/lib/acme-webroot`}
      />
      <p>
        Der Webroot-Ordner muss nicht von HAProxy ausgeliefert werden: local-cert liest die
        Challenge nicht.
      </p>

      <h2>2. Deployment zu HAProxy</h2>
      <CodeBlock
        title="acme.sh — Hook haproxy"
        code={`export DEPLOY_HAPROXY_PEM_PATH=/etc/haproxy/certs
export DEPLOY_HAPROXY_RELOAD="systemctl reload haproxy"
acme.sh --deploy -d ${EX.host} --deploy-hook haproxy`}
      />
      <p>
        Der Hook schreibt <code>/etc/haproxy/certs/{EX.host}.pem</code> (Zertifikat, Kette und
        Schlüssel in einer Datei). Beide Variablen werden gespeichert: Jede Erneuerung durch den
        Cron-Job von acme.sh deployt erneut und lädt neu.
      </p>

      <h2>3. Das Frontend</h2>
      <CodeBlock
        title="/etc/haproxy/haproxy.cfg (Auszug)"
        code={`frontend https
    bind :443 ssl crt /etc/haproxy/certs/
    http-request set-header X-Forwarded-Proto https
    use_backend nas if { hdr(host) -i ${EX.host} }

backend nas
    server nas 192.168.1.50:5000`}
      />

      <Callout title="Natives ACME in HAProxy">
        HAProxy 3.2 und neuer enthalten einen ACME-Client. Prüfen Sie in der Dokumentation Ihrer
        Version, ob er External Account Binding unterstützt, bevor Sie ihn mit local-cert
        verwenden; ohne EAB wird die Registrierung abgelehnt.
      </Callout>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Clients({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>certbot, acme.sh, lego</h1>
      <p className="lead">
        Die drei Kommandozeilen-Clients. Sie genügen, um jeden Rechner auszustatten, und die
        meisten Integrationen der anderen Anleitungen beruhen auf einem von ihnen.
      </p>
      <EabValues ctx={ctx} />

      <Callout title="Die Challenge wird nie abgerufen">
        local-cert liest die HTTP-01-Antwort nicht. Sie können daher den Modus <b>webroot</b> mit
        einem beliebigen Ordner verwenden, auch wenn dieser von keinem Webserver ausgeliefert wird:
        Das ist am einfachsten, wenn Port 80 bereits belegt ist.
      </Callout>

      <h2>certbot</h2>
      <p>Port 80 auf dem Rechner frei: Standalone-Modus.</p>
      <CodeBlock
        title="certbot — standalone"
        code={`certbot certonly --standalone -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} \\
  --email ${EX.email} --agree-tos --no-eff-email`}
      />
      <p>Port 80 belegt: Webroot-Modus, mit einem leeren Ordner.</p>
      <CodeBlock
        title="certbot — webroot"
        code={`mkdir -p /var/lib/letsencrypt/webroot
certbot certonly --webroot -w /var/lib/letsencrypt/webroot -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} \\
  --email ${EX.email} --agree-tos --no-eff-email \\
  --deploy-hook "systemctl reload nginx"`}
      />
      <p>
        Die Dateien landen in <code>/etc/letsencrypt/live/{EX.host}/</code>. Server und EAB werden
        in der Erneuerungsdatei gespeichert: Der vom Paket installierte Timer{' '}
        <code>certbot renew</code> erneuert ohne weitere Einstellungen. Prüfen Sie dies mit{' '}
        <code>certbot renew --dry-run</code>.
      </p>

      <h2>acme.sh</h2>
      <p>Die Kontoregistrierung ist ein separater Schritt, der einmal pro Rechner erfolgt.</p>
      <CodeBlock
        title="acme.sh"
        code={`# 1. Konto, mit dem EAB
acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} -m ${EX.email}

# 2. Ausstellung (webroot mit einem leeren Ordner)
mkdir -p /var/lib/acme-webroot
acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /var/lib/acme-webroot

# 3. Dateien installieren und Befehl zum Neuladen
acme.sh --install-cert -d ${EX.host} \\
  --key-file       /etc/ssl/private/${EX.host}.key \\
  --fullchain-file /etc/ssl/certs/${EX.host}.pem \\
  --reloadcmd      "systemctl reload nginx"`}
      />
      <p>
        Ist Port 80 frei, ersetzen Sie <code>-w …</code> durch <code>--standalone</code> (
        <code>socat</code> erforderlich). Die Erneuerung läuft über den von acme.sh installierten
        Cron-Job; der Webroot-Ordner muss daher dauerhaft existieren, weshalb ein Pfad außerhalb
        von <code>/tmp</code> zu wählen ist.
      </p>

      <h2>lego</h2>
      <CodeBlock
        title="lego"
        code={`lego --server ${ctx.directory} \\
  --eab --kid ${EX.kid} --hmac ${EX.hmac} \\
  --email ${EX.email} --accept-tos \\
  --http --domains ${EX.host} \\
  run`}
      />
      <p>
        Die Dateien landen in <code>./.lego/certificates/</code>. lego installiert keinen
        geplanten Task: Planen Sie denselben Befehl selbst, mit <code>renew --days 30</code> am
        Ende. Ist Port 80 belegt, ergänzen Sie <code>--http.webroot /var/lib/acme-webroot</code>.
      </p>

      <h2>Überprüfen</h2>
      <CodeBlock
        title="openssl"
        code={`openssl x509 -in /etc/letsencrypt/live/${EX.host}/fullchain.pem -noout -issuer -subject -enddate`}
      />
      <p>
        Der Aussteller muss Let&apos;s Encrypt sein (oder <i>(STAGING)</i>, solange local-cert in
        der Testumgebung läuft). Das Zertifikat erscheint auch unter{' '}
        <Link href="/admin/certificates">Zertifikate</Link>.
      </p>
    </>
  );
}

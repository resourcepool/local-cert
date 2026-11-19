import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Clients({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>certbot, acme.sh, lego</h1>
      <p className="lead">
        I tre client da riga di comando. Bastano a equipaggiare qualsiasi macchina, e la maggior
        parte delle integrazioni descritte nelle altre guide si basa su uno di essi.
      </p>
      <EabValues ctx={ctx} />

      <Callout title="La challenge non viene mai recuperata">
        local-cert non legge la risposta HTTP-01. È quindi possibile usare la modalità{' '}
        <b>webroot</b> verso una cartella qualsiasi, anche se non è servita da alcun web server:
        è la soluzione più semplice quando la porta 80 è già occupata.
      </Callout>

      <h2>certbot</h2>
      <p>Porta 80 libera sulla macchina: modalità standalone.</p>
      <CodeBlock
        title="certbot — standalone"
        code={`certbot certonly --standalone -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} \\
  --email ${EX.email} --agree-tos --no-eff-email`}
      />
      <p>Porta 80 occupata: modalità webroot, verso una cartella vuota.</p>
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
        I file vengono salvati in <code>/etc/letsencrypt/live/{EX.host}/</code>. Il server e
        l&apos;EAB sono memorizzati nel file di rinnovo: il timer <code>certbot renew</code>{' '}
        installato dal pacchetto rinnova senza ulteriori impostazioni. Verificare con{' '}
        <code>certbot renew --dry-run</code>.
      </p>

      <h2>acme.sh</h2>
      <p>La registrazione dell&apos;account è un passaggio separato, da eseguire una volta per macchina.</p>
      <CodeBlock
        title="acme.sh"
        code={`# 1. account, con l'EAB
acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac} -m ${EX.email}

# 2. emissione (webroot verso una cartella vuota)
mkdir -p /var/lib/acme-webroot
acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /var/lib/acme-webroot

# 3. installazione dei file e comando di ricaricamento
acme.sh --install-cert -d ${EX.host} \\
  --key-file       /etc/ssl/private/${EX.host}.key \\
  --fullchain-file /etc/ssl/certs/${EX.host}.pem \\
  --reloadcmd      "systemctl reload nginx"`}
      />
      <p>
        Con la porta 80 libera, sostituire <code>-w …</code> con <code>--standalone</code> (
        <code>socat</code> necessario). Il rinnovo avviene tramite il job cron installato da
        acme.sh; la cartella webroot deve quindi esistere in modo permanente, da cui la scelta di
        un percorso al di fuori di <code>/tmp</code>.
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
        I file vengono salvati in <code>./.lego/certificates/</code>. lego non installa alcuna
        attività pianificata: occorre programmare autonomamente lo stesso comando terminato da{' '}
        <code>renew --days 30</code>. Con la porta 80 occupata, aggiungere{' '}
        <code>--http.webroot /var/lib/acme-webroot</code>.
      </p>

      <h2>Verificare</h2>
      <CodeBlock
        title="openssl"
        code={`openssl x509 -in /etc/letsencrypt/live/${EX.host}/fullchain.pem -noout -issuer -subject -enddate`}
      />
      <p>
        L&apos;emittente deve essere Let&apos;s Encrypt (oppure <i>(STAGING)</i> finché local-cert
        è in ambiente di test). Il certificato compare anche in{' '}
        <Link href="/admin/certificates">Certificati</Link>.
      </p>
    </>
  );
}

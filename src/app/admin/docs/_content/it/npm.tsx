import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function NginxProxyManager({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Nginx Proxy Manager</h1>
      <p className="lead">
        L&apos;interfaccia di Nginx Proxy Manager non consente di scegliere né il server ACME né
        un EAB: la sua emissione integrata parla solo con Let&apos;s Encrypt. Il certificato
        viene quindi ottenuto a parte, poi importato come certificato personalizzato.
      </p>

      <h2>1. Ottenere il certificato</h2>
      <p>
        Sull&apos;host, con acme.sh (per i dettagli vedere{' '}
        <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>):
      </p>
      <CodeBlock
        title="acme.sh"
        code={`acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid eab_XXXXXXXXXXXXXXXX --eab-hmac-key CLE_HMAC -m ops@example.com

mkdir -p /var/lib/acme-webroot /opt/npm-certs
acme.sh --issue --server ${ctx.directory} -d ${EX.host} -w /var/lib/acme-webroot
acme.sh --install-cert -d ${EX.host} \\
  --key-file       /opt/npm-certs/${EX.host}.key \\
  --fullchain-file /opt/npm-certs/${EX.host}.pem`}
      />

      <h2>2. Importarlo</h2>
      <ol>
        <li>
          <b>SSL Certificates</b> → <b>Add SSL Certificate</b> → <b>Custom</b>.
        </li>
        <li>
          Chiave: <code>{EX.host}.key</code>. Certificato: <code>{EX.host}.pem</code>.
        </li>
        <li>
          Nel <b>Proxy Host</b>, scheda <b>SSL</b>, scegliere questo certificato.
        </li>
      </ol>

      <Callout kind="warn" title="Il rinnovo non è automatico">
        acme.sh rinnova i file, ma Nginx Proxy Manager conserva la copia importata. Circa ogni due
        mesi, reimportare il certificato — oppure, se si può scegliere, preferire un proxy che
        parli ACME con una CA personalizzata (Traefik, Caddy), dove tutto è automatico.
      </Callout>

      <h2>Altra via: lasciare a local-cert la gestione della chiave</h2>
      <p>
        Tramite l&apos;<Link href="/admin/api">API</Link>, local-cert genera la chiave, rinnova da
        solo ed espone il certificato aggiornato. A uno script pianificato non resta che scaricare
        il bundle e caricarlo in Nginx Proxy Manager. Vedere{' '}
        <Link href="/admin/docs/acme/others">Altri sistemi</Link>.
      </p>
    </>
  );
}

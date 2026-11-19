import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function Others({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Altri sistemi</h1>
      <p className="lead">
        Due ricette coprono tutto ciò che non ha una guida propria: un client ACME generico quando
        il sistema ne accetta uno, l&apos;API di local-cert quando sa solo importare un
        certificato.
      </p>

      <h2>Riconoscere il caso giusto</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Il sistema…</th>
              <th>Ricetta</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ha un client ACME con URL di CA personalizzato, EAB e HTTP-01</td>
              <td>
                configurarlo con i tre valori della credenziale EAB, come in{' '}
                <Link href="/admin/docs/acme">Server ACME</Link>
              </td>
            </tr>
            <tr>
              <td>offre accesso shell</td>
              <td>
                acme.sh e un hook di distribuzione — vedere{' '}
                <Link href="/admin/docs/acme/clients">certbot, acme.sh, lego</Link>
              </td>
            </tr>
            <tr>
              <td>sa solo importare un certificato, oppure solo fare DNS-01</td>
              <td>l&apos;API di local-cert, qui sotto</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Indicazioni per sistema</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sistema</th>
              <th>Approccio</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>OPNsense</td>
              <td>
                Plugin <code>os-acme-client</code>: creare un account su una CA personalizzata con
                l&apos;URL della directory e i campi EAB, poi un certificato con challenge HTTP-01.
                Il plugin si basa su acme.sh.
              </td>
            </tr>
            <tr>
              <td>pfSense</td>
              <td>
                Pacchetto ACME: se la propria versione offre un server ACME personalizzato con EAB,
                stessa procedura. Altrimenti, acme.sh da shell, poi importazione in{' '}
                <b>System</b> → <b>Certificates</b>.
              </td>
            </tr>
            <tr>
              <td>TrueNAS</td>
              <td>
                Il suo client ACME supporta solo DNS-01 con i propri fornitori: usare l&apos;API di
                local-cert, poi importare il certificato.
              </td>
            </tr>
            <tr>
              <td>Unraid, UniFi, stampanti, iDRAC/iLO, apparati di rete</td>
              <td>Importazione del certificato: API di local-cert.</td>
            </tr>
            <tr>
              <td>Zoraxy, SWAG, proxy basati su lego o certbot</td>
              <td>
                Se espongono l&apos;URL della CA e l&apos;EAB, caso generico. Altrimenti,
                importazione.
              </td>
            </tr>
            <tr>
              <td>Envoy, proxy senza client ACME</td>
              <td>
                acme.sh o lego accanto, file montati nel proxy, ricaricamento tramite hook.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout title="Prima di provare un client ACME integrato">
        Verificare i tre prerequisiti: URL della directory libero, External Account Binding,
        challenge HTTP-01. Se ne manca uno, passare direttamente all&apos;API: si risparmia tempo.
      </Callout>

      <h2>Ricetta API: local-cert conserva la chiave e rinnova</h2>
      <p>
        Qui il sistema di destinazione non comunica con local-cert. È local-cert a generare la
        chiave, ottenere il certificato e rinnovarlo, mentre uno script va a recuperare la
        versione aggiornata. Serve una <b>chiave API</b> (<Link href="/admin/keys">Chiavi e permessi</Link>)
        con i permessi <code>cert:issue</code>, <code>cert:read</code> e <code>cert:export</code>{' '}
        sul dominio.
      </p>
      <h3>1. Richiedere il certificato, una volta</h3>
      <CodeBlock
        title="curl"
        code={`curl -X POST ${ctx.origin}/api/v1/certificates \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H 'content-type: application/json' \\
  -d '{"domains": ["${EX.host}"], "key_type": "ec-256", "auto_renew": true}'
# → { "id": "cert_…", "status": "pending", … }`}
      />
      <h3>2. Recuperare certificato e chiave, a ogni esecuzione</h3>
      <CodeBlock
        title="script pianificato (cron, giornaliero)"
        code={`#!/bin/sh
set -eu
ID=cert_XXXXXXXXXXXXXXXX
OUT=/etc/ssl/local-cert

curl -fsS -H "Authorization: Bearer $TOKEN" \\
  "${ctx.origin}/api/v1/certificates/$ID/bundle?format=pem&include=fullchain" \\
  -o "$OUT/fullchain.pem.new"
curl -fsS -H "Authorization: Bearer $TOKEN" \\
  "${ctx.origin}/api/v1/certificates/$ID/bundle?format=pem&include=key" \\
  -o "$OUT/privkey.pem.new"

# ricarica solo se il certificato è cambiato
if ! cmp -s "$OUT/fullchain.pem.new" "$OUT/fullchain.pem"; then
  mv "$OUT/fullchain.pem.new" "$OUT/fullchain.pem"
  mv "$OUT/privkey.pem.new"  "$OUT/privkey.pem"
  # qui: il comando di importazione o ricaricamento del sistema di destinazione
fi`}
      />
      <p>
        Invece di interrogare ogni giorno, la richiesta accetta un <code>webhook_url</code>{' '}
        richiamato a ogni emissione e rinnovo. Il dettaglio delle route è in{' '}
        <Link href="/admin/api">API</Link>.
      </p>
    </>
  );
}

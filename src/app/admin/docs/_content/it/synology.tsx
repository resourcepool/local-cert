import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Synology({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Synology DSM</h1>
      <p className="lead">
        La procedura guidata dei certificati di DSM conosce solo Let&apos;s Encrypt e richiede che
        il NAS sia raggiungibile da Internet. acme.sh, installato sul NAS, ottiene il certificato
        da local-cert e lo installa in DSM con il proprio hook <code>synology_dsm</code>.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Preparare il NAS</h2>
      <ol>
        <li>
          <b>Pannello di controllo</b> → <b>Terminale e SNMP</b> → attivare SSH.
        </li>
        <li>
          Collegarsi in SSH con un account amministratore, poi <code>sudo -i</code>.
        </li>
      </ol>
      <CodeBlock
        title="installare acme.sh fuori dal volume di sistema"
        code={`mkdir -p /usr/local/share/acme.sh/webroot
cd /tmp && wget -O acme.sh.tar.gz https://github.com/acmesh-official/acme.sh/archive/master.tar.gz
tar xzf acme.sh.tar.gz && cd acme.sh-master
./acme.sh --install --nocron --home /usr/local/share/acme.sh -m ${EX.email}
cd /usr/local/share/acme.sh`}
      />

      <h2>2. Account ed emissione</h2>
      <CodeBlock
        title="acme.sh"
        code={`./acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac}

./acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /usr/local/share/acme.sh/webroot`}
      />
      <p>
        La cartella webroot resta vuota e non è servita da nulla: local-cert non legge la
        challenge. Il NAS non richiede l&apos;apertura di alcuna porta.
      </p>

      <h2>3. Installare in DSM</h2>
      <CodeBlock
        title="acme.sh — hook synology_dsm"
        code={`export SYNO_SCHEME=http
export SYNO_HOSTNAME=localhost
export SYNO_PORT=5000
export SYNO_USERNAME='un-account-admin'
export SYNO_PASSWORD='la-sua-password'
export SYNO_CERTIFICATE='local-cert'   # descrizione del certificato in DSM
export SYNO_CREATE=1                    # crearlo se non esiste

./acme.sh --deploy -d ${EX.host} --deploy-hook synology_dsm`}
      />
      <p>
        Il certificato compare in <b>Pannello di controllo</b> → <b>Sicurezza</b> →{' '}
        <b>Certificato</b>. Assegnarlo ai servizi desiderati con <b>Impostazioni</b>.
      </p>
      <Callout kind="warn" title="Account e autenticazione a due fattori">
        L&apos;hook si collega a DSM con questo account. Creare un amministratore dedicato, senza
        autenticazione a due fattori, oppure usare le variabili previste per l&apos;OTP dalle
        versioni recenti di acme.sh. I nomi delle variabili sono cambiati nel corso delle versioni
        (<code>SYNO_Username</code> → <code>SYNO_USERNAME</code>): se l&apos;hook non le vede,
        consultare l&apos;intestazione di <code>deploy/synology_dsm.sh</code>.
      </Callout>

      <h2>4. Rinnovo</h2>
      <p>
        <b>Pannello di controllo</b> → <b>Utilità di pianificazione</b> → <b>Crea</b> →{' '}
        <b>Attività pianificata</b> → <b>Script definito dall&apos;utente</b>, utente{' '}
        <code>root</code>, ogni giorno:
      </p>
      <CodeBlock
        title="script"
        code={`/usr/local/share/acme.sh/acme.sh --cron --home /usr/local/share/acme.sh`}
      />
      <p>
        acme.sh rinnova solo in prossimità della scadenza, poi ripete la distribuzione in DSM con
        le impostazioni memorizzate.
      </p>
    </>
  );
}

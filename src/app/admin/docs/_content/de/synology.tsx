import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Synology({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Synology DSM</h1>
      <p className="lead">
        Der Zertifikatsassistent von DSM kennt nur Let&apos;s Encrypt und verlangt, dass das NAS
        aus dem Internet erreichbar ist. acme.sh, auf dem NAS installiert, besorgt das Zertifikat
        bei local-cert und installiert es mit seinem Hook <code>synology_dsm</code> in DSM.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Das NAS vorbereiten</h2>
      <ol>
        <li>
          <b>Systemsteuerung</b> → <b>Terminal &amp; SNMP</b> → aktivieren Sie SSH.
        </li>
        <li>
          Verbinden Sie sich per SSH mit einem Administratorkonto und führen Sie dann{' '}
          <code>sudo -i</code> aus.
        </li>
      </ol>
      <CodeBlock
        title="acme.sh außerhalb des Systemvolumes installieren"
        code={`mkdir -p /usr/local/share/acme.sh/webroot
cd /tmp && wget -O acme.sh.tar.gz https://github.com/acmesh-official/acme.sh/archive/master.tar.gz
tar xzf acme.sh.tar.gz && cd acme.sh-master
./acme.sh --install --nocron --home /usr/local/share/acme.sh -m ${EX.email}
cd /usr/local/share/acme.sh`}
      />

      <h2>2. Konto und Ausstellung</h2>
      <CodeBlock
        title="acme.sh"
        code={`./acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac}

./acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /usr/local/share/acme.sh/webroot`}
      />
      <p>
        Der Webroot-Ordner bleibt leer und wird von nichts ausgeliefert: local-cert liest die
        Challenge nicht. Das NAS benötigt keinerlei Portfreigabe.
      </p>

      <h2>3. In DSM installieren</h2>
      <CodeBlock
        title="acme.sh — Hook synology_dsm"
        code={`export SYNO_SCHEME=http
export SYNO_HOSTNAME=localhost
export SYNO_PORT=5000
export SYNO_USERNAME='un-compte-admin'
export SYNO_PASSWORD='son-mot-de-passe'
export SYNO_CERTIFICATE='local-cert'   # Beschreibung des Zertifikats in DSM
export SYNO_CREATE=1                    # anlegen, falls es nicht existiert

./acme.sh --deploy -d ${EX.host} --deploy-hook synology_dsm`}
      />
      <p>
        Das Zertifikat erscheint unter <b>Systemsteuerung</b> → <b>Sicherheit</b> →{' '}
        <b>Zertifikat</b>. Weisen Sie es mit <b>Einstellungen</b> den gewünschten Diensten zu.
      </p>
      <Callout kind="warn" title="Konto und Zwei-Faktor-Authentifizierung">
        Der Hook meldet sich mit diesem Konto bei DSM an. Legen Sie einen eigenen Administrator
        ohne Zwei-Faktor-Authentifizierung an oder verwenden Sie die Variablen, die neuere
        acme.sh-Versionen für OTP vorsehen. Die Variablennamen haben sich im Lauf der Versionen
        geändert (<code>SYNO_Username</code> → <code>SYNO_USERNAME</code>): Sieht der Hook sie
        nicht, lesen Sie den Kopf von <code>deploy/synology_dsm.sh</code>.
      </Callout>

      <h2>4. Erneuerung</h2>
      <p>
        <b>Systemsteuerung</b> → <b>Aufgabenplaner</b> → <b>Erstellen</b> →{' '}
        <b>Geplante Aufgabe</b> → <b>Benutzerdefiniertes Skript</b>, Benutzer <code>root</code>,
        täglich:
      </p>
      <CodeBlock
        title="Skript"
        code={`/usr/local/share/acme.sh/acme.sh --cron --home /usr/local/share/acme.sh`}
      />
      <p>
        acme.sh erneuert erst kurz vor Ablauf und spielt dann das Deployment in DSM mit den
        gespeicherten Einstellungen erneut ab.
      </p>
    </>
  );
}

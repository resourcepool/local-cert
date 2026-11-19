import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Synology({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Synology DSM</h1>
      <p className="lead">
        DSM&apos;s certificate wizard only knows Let&apos;s Encrypt and requires the NAS to be
        reachable from the Internet. acme.sh, installed on the NAS, obtains the certificate from
        local-cert and installs it in DSM with its <code>synology_dsm</code> hook.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Prepare the NAS</h2>
      <ol>
        <li>
          <b>Control Panel</b> → <b>Terminal &amp; SNMP</b> → enable SSH.
        </li>
        <li>
          Connect over SSH with an administrator account, then <code>sudo -i</code>.
        </li>
      </ol>
      <CodeBlock
        title="install acme.sh outside the system volume"
        code={`mkdir -p /usr/local/share/acme.sh/webroot
cd /tmp && wget -O acme.sh.tar.gz https://github.com/acmesh-official/acme.sh/archive/master.tar.gz
tar xzf acme.sh.tar.gz && cd acme.sh-master
./acme.sh --install --nocron --home /usr/local/share/acme.sh -m ${EX.email}
cd /usr/local/share/acme.sh`}
      />

      <h2>2. Account and issuance</h2>
      <CodeBlock
        title="acme.sh"
        code={`./acme.sh --register-account --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac}

./acme.sh --issue --server ${ctx.directory} \\
  -d ${EX.host} -w /usr/local/share/acme.sh/webroot`}
      />
      <p>
        The webroot folder stays empty and is served by nothing: local-cert never reads the
        challenge. The NAS needs no open port.
      </p>

      <h2>3. Install in DSM</h2>
      <CodeBlock
        title="acme.sh — synology_dsm hook"
        code={`export SYNO_SCHEME=http
export SYNO_HOSTNAME=localhost
export SYNO_PORT=5000
export SYNO_USERNAME='an-admin-account'
export SYNO_PASSWORD='its-password'
export SYNO_CERTIFICATE='local-cert'   # certificate description in DSM
export SYNO_CREATE=1                    # create it if it doesn't exist

./acme.sh --deploy -d ${EX.host} --deploy-hook synology_dsm`}
      />
      <p>
        The certificate appears in <b>Control Panel</b> → <b>Security</b> → <b>Certificate</b>.
        Assign it to the services you want with <b>Settings</b>.
      </p>
      <Callout kind="warn" title="Account and two-factor authentication">
        The hook signs in to DSM with this account. Create a dedicated administrator without
        two-factor authentication, or use the OTP variables provided by recent acme.sh versions.
        Variable names have changed across versions (<code>SYNO_Username</code> →{' '}
        <code>SYNO_USERNAME</code>): if the hook doesn&apos;t see them, check the header of{' '}
        <code>deploy/synology_dsm.sh</code>.
      </Callout>

      <h2>4. Renewal</h2>
      <p>
        <b>Control Panel</b> → <b>Task Scheduler</b> → <b>Create</b> → <b>Scheduled Task</b> →{' '}
        <b>User-defined script</b>, user <code>root</code>, every day:
      </p>
      <CodeBlock
        title="script"
        code={`/usr/local/share/acme.sh/acme.sh --cron --home /usr/local/share/acme.sh`}
      />
      <p>
        acme.sh only renews as expiry approaches, then replays the deployment into DSM with the
        remembered settings.
      </p>
    </>
  );
}

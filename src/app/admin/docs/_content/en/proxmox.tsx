import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Proxmox({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Proxmox VE</h1>
      <p className="lead">
        Proxmox ships with an ACME client. It accepts a custom directory and EAB: the node obtains
        and renews its certificate without any extra tool.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Register the account</h2>
      <p>From the command line on the node:</p>
      <CodeBlock
        title="pvenode"
        code={`pvenode acme account register local-cert ${EX.email} \\
  --directory ${ctx.directory}`}
      />
      <p>
        The command detects that the server requires an EAB and asks in turn for the{' '}
        <b>Key ID</b> (<code>{EX.kid}</code>) and then the <b>HMAC key</b>.
      </p>
      <p>
        From the web interface: <b>Datacenter</b> → <b>ACME</b> → <b>Accounts</b> → <b>Add</b>,
        directory <i>Custom</i>, paste the URL, then fill in the EAB fields.
      </p>

      <h2>2. Declare the name and order</h2>
      <CodeBlock
        title="pvenode"
        code={`pvenode config set --acme account=local-cert,domains=${EX.host}
pvenode acme cert order`}
      />
      <p>
        From the web interface: node → <b>System</b> → <b>Certificates</b> → <b>ACME</b> section:
        choose the <code>local-cert</code> account, add the domain with type <b>HTTP</b>, then{' '}
        <b>Order Certificates Now</b>.
      </p>
      <p>
        The <code>pveproxy</code> service restarts with the new certificate. Renewal is handled by
        the <code>pve-daily-update</code> timer.
      </p>

      <Callout title="Port 80">
        Proxmox&apos;s HTTP mode briefly opens a server on the node&apos;s port 80 to present the
        challenge. Nothing will query it, but the port must be free.
      </Callout>

      <h2>Good to know</h2>
      <ul>
        <li>
          In a cluster, the ACME account is shared; the domain configuration and the order are done
          node by node, each with its own name.
        </li>
        <li>
          <b>Proxmox Backup Server</b> and <b>Proxmox Mail Gateway</b> follow the same logic with{' '}
          <code>proxmox-backup-manager acme …</code> and <code>pmgconfig acme …</code>.
        </li>
      </ul>
    </>
  );
}

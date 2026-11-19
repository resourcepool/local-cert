import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Proxmox({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Proxmox VE</h1>
      <p className="lead">
        Proxmox bringt einen ACME-Client mit. Er akzeptiert ein benutzerdefiniertes Directory und
        EAB: Der Node besorgt und erneuert sein Zertifikat ohne zusätzliche Tools.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Das Konto registrieren</h2>
      <p>Auf der Kommandozeile des Nodes:</p>
      <CodeBlock
        title="pvenode"
        code={`pvenode acme account register local-cert ${EX.email} \\
  --directory ${ctx.directory}`}
      />
      <p>
        Der Befehl erkennt, dass der Server EAB verlangt, und fragt nacheinander nach der{' '}
        <b>Key ID</b> (<code>{EX.kid}</code>) und dann nach dem <b>HMAC-Schlüssel</b>.
      </p>
      <p>
        Über die Oberfläche: <b>Datacenter</b> → <b>ACME</b> → <b>Accounts</b> → <b>Add</b>,
        Directory <i>Custom</i>, URL einfügen und anschließend die EAB-Felder ausfüllen.
      </p>

      <h2>2. Den Namen deklarieren und bestellen</h2>
      <CodeBlock
        title="pvenode"
        code={`pvenode config set --acme account=local-cert,domains=${EX.host}
pvenode acme cert order`}
      />
      <p>
        Über die Oberfläche: Node → <b>System</b> → <b>Certificates</b> → Abschnitt <b>ACME</b>:
        das Konto <code>local-cert</code> wählen, die Domain mit dem Typ <b>HTTP</b> hinzufügen und
        dann <b>Order Certificates Now</b> klicken.
      </p>
      <p>
        Der Dienst <code>pveproxy</code> startet mit dem neuen Zertifikat neu. Die Erneuerung
        übernimmt der Timer <code>pve-daily-update</code>.
      </p>

      <Callout title="Port 80">
        Der HTTP-Modus von Proxmox öffnet kurzzeitig einen Server auf Port 80 des Nodes, um die
        Challenge zu präsentieren. Niemand wird ihn abfragen, aber der Port muss frei sein.
      </Callout>

      <h2>Wissenswertes</h2>
      <ul>
        <li>
          Im Cluster wird das ACME-Konto gemeinsam genutzt; Domain-Konfiguration und Bestellung
          erfolgen Node für Node, jeweils mit eigenem Namen.
        </li>
        <li>
          <b>Proxmox Backup Server</b> und <b>Proxmox Mail Gateway</b> folgen derselben Logik mit{' '}
          <code>proxmox-backup-manager acme …</code> und <code>pmgconfig acme …</code>.
        </li>
      </ul>
    </>
  );
}

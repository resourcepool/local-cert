import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Proxmox({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Proxmox VE</h1>
      <p className="lead">
        Proxmox include un client ACME. Accetta una directory personalizzata e l&apos;EAB: il
        nodo ottiene e rinnova il proprio certificato senza strumenti aggiuntivi.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Registrare l&apos;account</h2>
      <p>Da riga di comando sul nodo:</p>
      <CodeBlock
        title="pvenode"
        code={`pvenode acme account register local-cert ${EX.email} \\
  --directory ${ctx.directory}`}
      />
      <p>
        Il comando rileva che il server richiede un EAB e chiede in successione il <b>Key ID</b>{' '}
        (<code>{EX.kid}</code>) e poi la <b>chiave HMAC</b>.
      </p>
      <p>
        Dall&apos;interfaccia: <b>Datacenter</b> → <b>ACME</b> → <b>Accounts</b> → <b>Add</b>,
        directory <i>Custom</i>, incollare l&apos;URL, quindi compilare i campi EAB.
      </p>

      <h2>2. Dichiarare il nome e ordinare</h2>
      <CodeBlock
        title="pvenode"
        code={`pvenode config set --acme account=local-cert,domains=${EX.host}
pvenode acme cert order`}
      />
      <p>
        Dall&apos;interfaccia: nodo → <b>System</b> → <b>Certificates</b> → sezione <b>ACME</b>:
        scegliere l&apos;account <code>local-cert</code>, aggiungere il dominio di tipo{' '}
        <b>HTTP</b>, quindi <b>Order Certificates Now</b>.
      </p>
      <p>
        Il servizio <code>pveproxy</code> si riavvia con il nuovo certificato. Il rinnovo è
        garantito dal timer <code>pve-daily-update</code>.
      </p>

      <Callout title="Porta 80">
        La modalità HTTP di Proxmox apre brevemente un server sulla porta 80 del nodo per
        presentare la challenge. Nessuno lo interrogherà, ma la porta deve essere libera.
      </Callout>

      <h2>Da sapere</h2>
      <ul>
        <li>
          In un cluster, l&apos;account ACME è condiviso; la configurazione del dominio e
          l&apos;ordine si eseguono nodo per nodo, ciascuno con il proprio nome.
        </li>
        <li>
          <b>Proxmox Backup Server</b> e <b>Proxmox Mail Gateway</b> seguono la stessa logica con{' '}
          <code>proxmox-backup-manager acme …</code> e <code>pmgconfig acme …</code>.
        </li>
      </ul>
    </>
  );
}

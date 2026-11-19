import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Proxmox({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Proxmox VE</h1>
      <p className="lead">
        Proxmox incorpora un cliente ACME. Admite un directory personalizado y EAB: el nodo
        obtiene y renueva su certificado sin ninguna herramienta adicional.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Registrar la cuenta</h2>
      <p>En la línea de comandos del nodo:</p>
      <CodeBlock
        title="pvenode"
        code={`pvenode acme account register local-cert ${EX.email} \\
  --directory ${ctx.directory}`}
      />
      <p>
        El comando detecta que el servidor exige un EAB y solicita sucesivamente el{' '}
        <b>Key ID</b> (<code>{EX.kid}</code>) y después la <b>clave HMAC</b>.
      </p>
      <p>
        Desde la interfaz: <b>Datacenter</b> → <b>ACME</b> → <b>Accounts</b> → <b>Add</b>,
        directory <i>Custom</i>, pegar la URL y rellenar después los campos EAB.
      </p>

      <h2>2. Declarar el nombre y solicitar</h2>
      <CodeBlock
        title="pvenode"
        code={`pvenode config set --acme account=local-cert,domains=${EX.host}
pvenode acme cert order`}
      />
      <p>
        Desde la interfaz: nodo → <b>System</b> → <b>Certificates</b> → sección <b>ACME</b>:
        elegir la cuenta <code>local-cert</code>, añadir el dominio con el tipo <b>HTTP</b> y
        pulsar <b>Order Certificates Now</b>.
      </p>
      <p>
        El servicio <code>pveproxy</code> se reinicia con el nuevo certificado. La renovación
        corre a cargo del temporizador <code>pve-daily-update</code>.
      </p>

      <Callout title="Puerto 80">
        El modo HTTP de Proxmox abre brevemente un servidor en el puerto 80 del nodo para
        presentar el desafío. Nadie va a consultarlo, pero el puerto debe estar libre.
      </Callout>

      <h2>Conviene saber</h2>
      <ul>
        <li>
          En un clúster, la cuenta ACME se comparte; la configuración del dominio y el pedido se
          hacen nodo por nodo, cada uno con su propio nombre.
        </li>
        <li>
          <b>Proxmox Backup Server</b> y <b>Proxmox Mail Gateway</b> siguen la misma lógica con{' '}
          <code>proxmox-backup-manager acme …</code> y <code>pmgconfig acme …</code>.
        </li>
      </ul>
    </>
  );
}

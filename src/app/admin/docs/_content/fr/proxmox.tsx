import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Proxmox({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Proxmox VE</h1>
      <p className="lead">
        Proxmox embarque un client ACME. Il accepte un directory personnalisé et l&apos;EAB : le
        nœud obtient et renouvelle son certificat sans outil supplémentaire.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Enregistrer le compte</h2>
      <p>En ligne de commande sur le nœud :</p>
      <CodeBlock
        title="pvenode"
        code={`pvenode acme account register local-cert ${EX.email} \\
  --directory ${ctx.directory}`}
      />
      <p>
        La commande détecte que le serveur exige un EAB et demande successivement le{' '}
        <b>Key ID</b> (<code>{EX.kid}</code>) puis la <b>clé HMAC</b>.
      </p>
      <p>
        Par l&apos;interface : <b>Datacenter</b> → <b>ACME</b> → <b>Accounts</b> → <b>Add</b>,
        directory <i>Custom</i>, coller l&apos;URL, puis renseigner les champs EAB.
      </p>

      <h2>2. Déclarer le nom et commander</h2>
      <CodeBlock
        title="pvenode"
        code={`pvenode config set --acme account=local-cert,domains=${EX.host}
pvenode acme cert order`}
      />
      <p>
        Par l&apos;interface : nœud → <b>System</b> → <b>Certificates</b> → section <b>ACME</b> :
        choisir le compte <code>local-cert</code>, ajouter le domaine en type <b>HTTP</b>, puis{' '}
        <b>Order Certificates Now</b>.
      </p>
      <p>
        Le service <code>pveproxy</code> redémarre avec le nouveau certificat. Le renouvellement
        est assuré par le timer <code>pve-daily-update</code>.
      </p>

      <Callout title="Port 80">
        Le mode HTTP de Proxmox ouvre brièvement un serveur sur le port 80 du nœud pour présenter
        le challenge. Rien ne viendra l&apos;interroger, mais le port doit être libre.
      </Callout>

      <h2>À savoir</h2>
      <ul>
        <li>
          En cluster, le compte ACME est partagé ; la configuration du domaine et la commande se
          font nœud par nœud, chacun avec son propre nom.
        </li>
        <li>
          <b>Proxmox Backup Server</b> et <b>Proxmox Mail Gateway</b> suivent la même logique avec{' '}
          <code>proxmox-backup-manager acme …</code> et <code>pmgconfig acme …</code>.
        </li>
      </ul>
    </>
  );
}

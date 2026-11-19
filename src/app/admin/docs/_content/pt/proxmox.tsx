import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Proxmox({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Proxmox VE</h1>
      <p className="lead">
        O Proxmox inclui um cliente ACME. Aceita um directory personalizado e o EAB: o nó obtém e
        renova o seu certificado sem qualquer ferramenta adicional.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Registar a conta</h2>
      <p>Na linha de comandos, no nó:</p>
      <CodeBlock
        title="pvenode"
        code={`pvenode acme account register local-cert ${EX.email} \\
  --directory ${ctx.directory}`}
      />
      <p>
        O comando deteta que o servidor exige um EAB e pede sucessivamente o <b>Key ID</b> (
        <code>{EX.kid}</code>) e depois a <b>chave HMAC</b>.
      </p>
      <p>
        Pela interface: <b>Datacenter</b> → <b>ACME</b> → <b>Accounts</b> → <b>Add</b>, directory{' '}
        <i>Custom</i>, colar o URL e depois preencher os campos EAB.
      </p>

      <h2>2. Declarar o nome e pedir</h2>
      <CodeBlock
        title="pvenode"
        code={`pvenode config set --acme account=local-cert,domains=${EX.host}
pvenode acme cert order`}
      />
      <p>
        Pela interface: nó → <b>System</b> → <b>Certificates</b> → secção <b>ACME</b>: escolher a
        conta <code>local-cert</code>, adicionar o domínio do tipo <b>HTTP</b> e depois{' '}
        <b>Order Certificates Now</b>.
      </p>
      <p>
        O serviço <code>pveproxy</code> reinicia com o novo certificado. A renovação é assegurada
        pelo temporizador <code>pve-daily-update</code>.
      </p>

      <Callout title="Porta 80">
        O modo HTTP do Proxmox abre brevemente um servidor na porta 80 do nó para apresentar o
        desafio. Nada o vai consultar, mas a porta tem de estar livre.
      </Callout>

      <h2>A ter em conta</h2>
      <ul>
        <li>
          Num cluster, a conta ACME é partilhada; a configuração do domínio e o pedido fazem-se nó
          a nó, cada um com o seu próprio nome.
        </li>
        <li>
          O <b>Proxmox Backup Server</b> e o <b>Proxmox Mail Gateway</b> seguem a mesma lógica com{' '}
          <code>proxmox-backup-manager acme …</code> e <code>pmgconfig acme …</code>.
        </li>
      </ul>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout } from '../../_lib/prose';

export default function Gcp() {
  return (
    <>
      <h1>Fornecedor Google Cloud</h1>
      <p className="lead">
        O local-cert gere o Cloud DNS como conta de serviço, a partir da respetiva chave JSON. Um
        fornecedor corresponde a um projeto Google Cloud.
      </p>

      <h2>Antes de começar</h2>
      <ul>
        <li>
          A API <b>Cloud DNS</b> está ativada no projeto (<b>APIs e serviços</b> →{' '}
          <b>Biblioteca</b> → Cloud DNS API).
        </li>
        <li>
          A zona é <b>pública</b>. Uma zona privada é invisível para o Let&apos;s Encrypt.
        </li>
      </ul>

      <h2>1. Criar a conta de serviço</h2>
      <ol>
        <li>
          Consola Google Cloud, projeto que contém as suas zonas → <b>IAM e administrador</b> →{' '}
          <b>Contas de serviço</b> → <b>Criar conta de serviço</b>.
        </li>
        <li>
          <b>Nome</b>: <code>local-cert-dns</code>. <b>Criar e continuar</b>.
        </li>
        <li>
          <b>Função</b>: <b>Administrador de DNS</b> (<code>roles/dns.admin</code>).{' '}
          <b>Continuar</b> e depois <b>Concluído</b>.
        </li>
      </ol>
      <p>Ou na linha de comandos:</p>
      <CodeBlock
        title="gcloud"
        code={`PROJECT=mon-projet
gcloud iam service-accounts create local-cert-dns --project "$PROJECT"
gcloud projects add-iam-policy-binding "$PROJECT" \\
  --member "serviceAccount:local-cert-dns@$PROJECT.iam.gserviceaccount.com" \\
  --role roles/dns.admin`}
      />

      <h2>2. Criar a chave JSON</h2>
      <ol>
        <li>
          Abra a conta de serviço → separador <b>Chaves</b> → <b>Adicionar chave</b> →{' '}
          <b>Criar nova chave</b> → <b>JSON</b>.
        </li>
        <li>É transferido um ficheiro <code>.json</code>: é o único exemplar.</li>
      </ol>
      <CodeBlock
        title="gcloud"
        code={`gcloud iam service-accounts keys create local-cert-dns.json \\
  --iam-account "local-cert-dns@$PROJECT.iam.gserviceaccount.com"`}
      />
      <Callout title="Criação de chaves bloqueada?">
        Algumas organizações proíbem as chaves de contas de serviço (restrição{' '}
        <code>iam.disableServiceAccountKeyCreation</code>). É então necessário que um
        administrador da organização a levante para este projeto.
      </Callout>

      <h2>3. Criar o fornecedor</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Fornecedores</Link> → <b>+ novo fornecedor</b> →{' '}
          <b>Google Cloud</b>.
        </li>
        <li>
          Dê um nome e cole <b>todo o conteúdo</b> do ficheiro JSON. O ID do projeto é lido a
          partir da chave; só o preencha se as zonas estiverem noutro projeto.
        </li>
        <li>
          <b>Testar a ligação</b> e depois <b>Guardar</b>. Elimine de seguida o ficheiro
          transferido.
        </li>
      </ol>

      <h2>4. Adicionar um domínio</h2>
      <p>
        <Link href="/admin/domains">Domínios</Link> → <b>+ adicionar um domínio</b> → este
        fornecedor → a zona. O teste cria e depois elimina um registo TXT temporário.
      </p>

      <h2>A ter em conta</h2>
      <ul>
        <li>
          A função <code>roles/dns.admin</code> abrange todas as zonas do projeto. Para isolar uma
          zona, coloque-a num projeto dedicado, ou conceda a função ao nível da zona e não do
          projeto (IAM da zona gerida), mantendo na conta o <code>roles/dns.reader</code> no
          projeto para a listagem.
        </li>
        <li>
          O domínio deve estar delegado nos servidores de nomes indicados pelo Cloud DNS para a
          zona (<code>ns-cloud-*.googledomains.com</code>).
        </li>
        <li>
          Vários projetos: um fornecedor por projeto, cada um com a sua conta de serviço — ou uma
          única conta de serviço à qual cada projeto concede a função, declarada em tantos
          fornecedores quantos os <b>IDs de projeto</b> diferentes.
        </li>
      </ul>

      <h2>Resolução de problemas</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mensagem</th>
              <th>Causa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>invalid_grant</code>
              </td>
              <td>Chave eliminada ou conta de serviço desativada; relógio do servidor desajustado.</td>
            </tr>
            <tr>
              <td>
                <code>403 … Cloud DNS API has not been used</code>
              </td>
              <td>A API Cloud DNS não está ativada no projeto.</td>
            </tr>
            <tr>
              <td>
                <code>403 Forbidden</code>
              </td>
              <td>A conta de serviço não tem a função de DNS neste projeto.</td>
            </tr>
            <tr>
              <td>
                <code>The service account key is not valid JSON</code>
              </td>
              <td>O ficheiro foi colado parcialmente.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

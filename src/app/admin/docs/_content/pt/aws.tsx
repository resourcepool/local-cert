import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import {
  PLACEHOLDER_ROLE_ARN,
  PLACEHOLDER_USER_ARN,
  assumePolicy,
  permissionsPolicy,
  trustPolicy,
} from '@/lib/dns/aws-policy';
import { Callout } from '../../_lib/prose';

const json = (doc: unknown) => JSON.stringify(doc, null, 2);
const EXAMPLE = { userArn: PLACEHOLDER_USER_ARN, roleArn: PLACEHOLDER_ROLE_ARN };

export default function AwsProvider() {
  return (
    <>
      <h1>Fornecedor AWS</h1>
      <p className="lead">
        Um fornecedor é uma identidade numa conta AWS, que o local-cert utiliza para ler e escrever
        no Route53. Cria-se um por conta — <code>aws-prod</code>,{' '}
        <code>aws-lab</code> — e depois declaram-se os domínios sobre ele.
      </p>

      <h2>O modelo</h2>
      <p>Três objetos do lado da AWS, cada um com uma função precisa:</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Objeto</th>
              <th>Função</th>
              <th>O que contém</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Utilizador IAM</td>
              <td>a identidade do local-cert</td>
              <td>um par de chaves, e nada mais</td>
            </tr>
            <tr>
              <td>Função IAM</td>
              <td>o que o local-cert está autorizado a fazer</td>
              <td>a política Route53, que vai sendo atualizada</td>
            </tr>
            <tr>
              <td>Política da função</td>
              <td>a lista das zonas autorizadas</td>
              <td>gerada pelo local-cert, colada por si</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        A chave guardada no local-cert não concede, por isso, qualquer permissão por si só: serve
        apenas para assumir a função. Adicionar uma zona é alterar a política da função; a chave
        nunca muda.
      </p>
      <p>
        O assistente da página <Link href="/admin/providers">Fornecedores</Link> percorre estes
        passos e gera cada documento com as suas credenciais reais. Este guia detalha-os.
      </p>

      <h2>1. Criar o utilizador IAM</h2>
      <ol>
        <li>
          Consola da AWS → <b>IAM</b> → <b>Users</b> → <b>Create user</b>.
        </li>
        <li>
          Nome: <code>local-cert</code>. Deixe desmarcada a opção{' '}
          <i>Provide user access to the AWS Management Console</i>.
        </li>
        <li>
          No passo das permissões: <b>não anexe nada</b>. Conclua a criação.
        </li>
        <li>
          Abra o utilizador → <b>Security credentials</b> → <b>Create access key</b> → caso de
          utilização <i>Application running outside AWS</i>.
        </li>
        <li>
          Anote o <b>Access key ID</b> e a <b>Secret access key</b>: a segunda deixa de poder ser
          consultada depois.
        </li>
      </ol>

      <h2>2. Introduzir a chave no local-cert</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Fornecedores</Link> → <b>+ novo fornecedor</b>.
        </li>
        <li>
          Dê um nome (<code>aws-prod</code>) e cole o par de chaves.
        </li>
        <li>
          <b>Verificar a chave</b>: o local-cert chama <code>sts:GetCallerIdentity</code>, que não
          exige qualquer permissão, e mostra o ARN do utilizador. É este ARN que serve para gerar
          o que se segue.
        </li>
      </ol>
      <p>
        A chave secreta é cifrada na base de dados (AES-256-GCM com <code>MASTER_KEY</code>) e
        nunca é mostrada de novo nem devolvida pela API.
      </p>

      <h2>3. Criar a função</h2>
      <ol>
        <li>
          <b>IAM</b> → <b>Roles</b> → <b>Create role</b> → <b>Custom trust policy</b>.
        </li>
        <li>
          Cole a <b>política de confiança</b> apresentada pelo assistente. Só autoriza o seu
          utilizador a assumir a função:
        </li>
      </ol>
      <CodeBlock title="Política de confiança (exemplo)" code={json(trustPolicy(PLACEHOLDER_USER_ARN))} />
      <ol start={3}>
        <li>
          No passo das permissões: não adicione nenhuma política gerida.
        </li>
        <li>
          Nome da função: <code>local-cert-dns</code>. Crie-a.
        </li>
        <li>
          Abra a função → <b>Permissions</b> → <b>Add permissions</b> →{' '}
          <b>Create inline policy</b> → separador <b>JSON</b>, e cole a{' '}
          <b>política de permissões</b> do assistente. Nesta fase só contém o necessário para
          listar as zonas:
        </li>
      </ol>
      <CodeBlock title="Política de permissões inicial" code={json(permissionsPolicy([], EXAMPLE))} />
      <ol start={6}>
        <li>
          Dê um nome à política (<code>local-cert-route53</code>), guarde-a e copie o{' '}
          <b>ARN da função</b> para o assistente.
        </li>
      </ol>

      <h2>4. Testar e guardar</h2>
      <p>
        <b>Testar a ligação</b> encadeia três verificações, cada uma dependente da anterior:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Verificação</th>
              <th>Em caso de falha</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Par de chaves</td>
              <td>chave desconhecida, desativada ou mal copiada</td>
            </tr>
            <tr>
              <td>Função (AssumeRole)</td>
              <td>
                ARN da função errado, ou política de confiança que não indica o utilizador correto
              </td>
            </tr>
            <tr>
              <td>Zonas (ListHostedZones)</td>
              <td>política de permissões ausente da função, ou ainda não propagada</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        O IAM aplica uma alteração em poucos segundos: um teste lançado logo após uma colagem pode
        falhar uma vez. Quando as três linhas estiverem em <code>OK</code>, clique em{' '}
        <b>Guardar</b>.
      </p>

      <h2>5. Adicionar domínios</h2>
      <p>
        O fornecedor já sabe listar as suas zonas, mas ainda não tem autorização para escrever em
        nenhuma. Essas permissões acrescentam-se zona a zona:{' '}
        <Link href="/admin/docs/domains">Adicionar um domínio</Link>. Depois de algumas zonas
        declaradas, a política da função fica semelhante a esta:
      </p>
      <CodeBlock
        title="Política de permissões com duas zonas (exemplo)"
        code={json(permissionsPolicy(['Z0123456ABCDEFGHIJK', 'Z0987654ZYXWVUTSRQP'], EXAMPLE))}
      />
      <p>
        O botão <b>política</b> de cada fornecedor regenera este documento a qualquer momento, a
        partir dos domínios efetivamente declarados.
      </p>

      <h2>O que a política autoriza</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ação</th>
              <th>Âmbito</th>
              <th>Porquê</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ListHostedZones</code>
              </td>
              <td>conta</td>
              <td>propor a lista das zonas; a AWS não permite restringi-la</td>
            </tr>
            <tr>
              <td>
                <code>GetChange</code>
              </td>
              <td>conta</td>
              <td>aguardar que uma escrita seja propagada</td>
            </tr>
            <tr>
              <td>
                <code>GetHostedZone</code>, <code>ListResourceRecordSets</code>
              </td>
              <td>zonas declaradas</td>
              <td>
                conhecer os servidores de nomes a consultar, listar os registos
              </td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code>
              </td>
              <td>zonas declaradas, tipos TXT / A / AAAA, ações UPSERT / DELETE</td>
              <td>
                escrever o TXT de validação; publicar o endereço de um anfitrião, se o pedir
              </td>
            </tr>
            <tr>
              <td>
                <code>iam:ListAccessKeys</code>, <code>DeleteAccessKey</code>,{' '}
                <code>ListUserPolicies</code>, <code>DeleteUserPolicy</code>,{' '}
                <code>DeleteUser</code>
              </td>
              <td>o utilizador IAM do fornecedor, e apenas esse</td>
              <td>
                facultativo: eliminá-lo ao remover o fornecedor (
                <a href="#nettoyage">limpeza</a>)
              </td>
            </tr>
            <tr>
              <td>
                <code>iam:ListRolePolicies</code>, <code>DeleteRolePolicy</code>
              </td>
              <td>a função do fornecedor, e apenas essa</td>
              <td>facultativo: esvaziar a função ao remover o fornecedor</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout kind="warn" title="Se alterar a política manualmente">
        Dois erros produzem um <code>AccessDenied</code> difícil de interpretar: retirar{' '}
        <code>TXT</code> dos tipos autorizados (deixa de ser possível qualquer emissão) e escrever
        dois blocos <code>Condition</code> com o mesmo operador (o JSON só guarda o último). O mais
        seguro é voltar a colar o documento gerado na íntegra.
      </Callout>

      <h2>Várias contas AWS</h2>
      <p>Há duas formas de cobrir uma segunda conta, consoante o que pretende isolar.</p>
      <h3>Um fornecedor por conta</h3>
      <p>
        Repita os passos 1 a 4 na outra conta e dê ao fornecedor um nome adequado. Cada conta tem
        a sua própria chave; revogar uma não afeta a outra. É a configuração mais simples de
        raciocinar.
      </p>
      <h3>Uma só chave, uma função por conta</h3>
      <p>
        O utilizador permanece na conta A; a função é criada na conta B, com a mesma política de
        confiança (o ARN do utilizador da conta A). Entre contas, o utilizador tem ainda de estar
        autorizado a assumir essa função. Anexe-lhe esta política inline:
      </p>
      <CodeBlock
        title="Política do utilizador, caso entre contas"
        code={json(assumePolicy(PLACEHOLDER_ROLE_ARN))}
      />
      <p>
        Crie depois um segundo fornecedor com o mesmo par de chaves e o ARN da função da conta B.
      </p>

      <h2>Variantes</h2>
      <h3>Sem função</h3>
      <p>
        Desmarque <i>Passar por uma função IAM</i> no assistente: a política de permissões é então
        colada diretamente no utilizador. É um passo a menos, ao preço de uma chave que contém ela
        própria as permissões.
      </p>
      <h3>Sem chave</h3>
      <p>
        Se o local-cert correr na AWS ou num cluster com IRSA, marque{' '}
        <i>Sem chave</i>: o fornecedor usa as credenciais do processo (função da instância,
        função do pod, variáveis de ambiente). Continua a ser possível assumir uma função por
        cima.
      </p>

      <h2>Declarar um fornecedor por variáveis de ambiente</h2>
      <p>
        Quando as credenciais devem vir da implementação e não da base de dados — segredos geridos
        pelo orquestrador, infraestrutura descrita em código — um fornecedor declara-se por
        variáveis. Tudo é facultativo: sem qualquer variável, os fornecedores gerem-se apenas a
        partir da consola.
      </p>
      <CodeBlock
        title=".env"
        code={`PROVIDER_AWS_DEFAULT_NAME="Default AWS"
PROVIDER_AWS_DEFAULT_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_DEFAULT_SECRET_ACCESS_KEY=…
PROVIDER_AWS_DEFAULT_ROLE_ARN=arn:aws:iam::123456789012:role/local-cert-dns

# uma segunda conta: o mesmo bloco, com outra etiqueta
PROVIDER_AWS_PROD_NAME="aws-prod"
PROVIDER_AWS_PROD_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_PROD_SECRET_ACCESS_KEY=…`}
      />
      <ul>
        <li>
          <code>_NAME</code> declara o fornecedor; é a única variável obrigatória do bloco. A
          etiqueta (<code>DEFAULT</code>, <code>PROD</code>…) é livre.
        </li>
        <li>
          Sem par de chaves, o fornecedor usa as credenciais do processo.{' '}
          <code>_ROLE_ARN</code> e <code>_REGION</code> são facultativos.
        </li>
        <li>
          Estes fornecedores aparecem na consola com a menção <i>ambiente</i>. Podem ser testados e
          a sua política pode ser gerada, mas não podem ser alterados nem removidos: isso faz-se
          nas variáveis, seguido de um reinício. A sua chave secreta nunca é escrita na base de
          dados.
        </li>
        <li>
          A etiqueta <code>DEFAULT</code> tem uma particularidade: os domínios declarados antes da
          chegada dos fornecedores ficam-lhe associados no arranque.
        </li>
      </ul>

      <h2 id="nettoyage">Remover um fornecedor e limpar a AWS</h2>
      <p>
        <Link href="/admin/providers">Fornecedores</Link> → <b>remover</b> apaga o fornecedor do
        local-cert. Ao marcar <b>Limpar também do lado da AWS</b>, o fornecedor desfaz primeiro o
        que o assistente o levou a criar:
      </p>
      <ol>
        <li>
          a sessão da função elimina o utilizador IAM: as suas chaves de acesso, as suas políticas
          inline e, por fim, o próprio utilizador;
        </li>
        <li>elimina depois a política da própria função.</li>
      </ol>
      <p>
        O IAM não permite que uma identidade se elimine por completo: uma função só pode ser
        eliminada depois de esvaziada das suas políticas, e é delas que vem a permissão para o
        fazer. Fica, portanto, a função <code>local-cert-dns</code>, sem qualquer permissão e que
        já ninguém pode assumir. A consola mostra o comando para a eliminar com uma conta de
        administrador:
      </p>
      <CodeBlock title="AWS CLI" code="aws iam delete-role --role-name local-cert-dns" />
      <ul>
        <li>
          Sem função, o fornecedor só consegue eliminar a sua própria chave de acesso; o utilizador
          permanece, sem credencial.
        </li>
        <li>
          As permissões correspondentes são os blocos <code>LocalCertRemove…</code> da política
          gerada. Visam apenas o utilizador e a função do fornecedor e só permitem eliminar: uma
          chave roubada poderia cortar o local-cert, mas não alargar as suas permissões. Retire-os
          do documento se não quiser esta opção.
        </li>
        <li>
          Um fornecedor criado antes desta opção deve primeiro receber a política atualizada
          (botão <b>política</b>). Se a AWS recusar antes de qualquer eliminação, o fornecedor é
          mantido.
        </li>
        <li>
          A opção não é oferecida quando outro fornecedor utiliza o mesmo utilizador ou a mesma
          função, nem para os fornecedores declarados por variáveis de ambiente.
        </li>
        <li>
          Se o utilizador tiver políticas geridas anexadas ou pertencer a um grupo, o IAM recusa a
          sua eliminação: a limpeza pára aí e lista o que falta fazer.
        </li>
      </ul>

      <h2>Rotação da chave</h2>
      <ol>
        <li>
          No IAM, crie uma <b>segunda</b> chave de acesso no utilizador.
        </li>
        <li>
          <Link href="/admin/providers">Fornecedores</Link> → <b>editar</b> →{' '}
          <i>Substituir o par de chaves</i> → <b>Testar</b> e, em seguida, <b>Guardar</b>.
        </li>
        <li>No IAM, desative a chave antiga e elimine-a.</li>
      </ol>
      <p>A função e a respetiva política não são afetadas.</p>
    </>
  );
}

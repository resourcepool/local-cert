import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function GoDaddy() {
  return (
    <>
      <h1>Fornecedor GoDaddy</h1>
      <p className="lead">
        O local-cert gere o DNS da GoDaddy com uma chave de API de produção. Verifique primeiro se
        a sua conta tem direito a ela: a GoDaddy não a disponibiliza a todos.
      </p>

      <Callout kind="warn" title="Condição de acesso à API">
        A GoDaddy reserva as suas APIs de gestão de domínios e de DNS às contas que possuam pelo
        menos dez domínios, ou uma subscrição Discount Domain Club. Abaixo disso, a chave cria-se
        normalmente, mas cada chamada responde <code>403 ACCESS_DENIED</code>. Se for o seu caso, a
        solução duradoura é delegar o subdomínio em causa num fornecedor de DNS suportado — ver no
        fim da página.
      </Callout>

      <h2>1. Criar a chave</h2>
      <ol>
        <li>
          Abra <code>https://developer.godaddy.com/keys</code>, com a sessão iniciada na conta que
          detém os domínios.
        </li>
        <li>
          <b>Create New API Key</b>. Nome: <code>local-cert</code>. Ambiente: <b>Production</b>{' '}
          (uma chave <i>OTE</i> não vê os seus domínios reais).
        </li>
        <li>
          Copie a <b>Key</b> e o <b>Secret</b>: o segredo só é mostrado uma vez.
        </li>
      </ol>
      <p>
        Uma chave da GoDaddy dá acesso a toda a conta: não existe restrição por domínio nem por
        tipo de operação.
      </p>

      <h2>2. Criar o fornecedor</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Fornecedores</Link> → <b>+ novo fornecedor</b> →{' '}
          <b>GoDaddy</b>.
        </li>
        <li>Dê um nome e cole a chave e o segredo.</li>
        <li>
          <b>Testar a ligação</b> e depois <b>Guardar</b>.
        </li>
      </ol>

      <h2>3. Adicionar um domínio</h2>
      <p>
        <Link href="/admin/domains">Domínios</Link> → <b>+ adicionar um domínio</b> → este
        fornecedor → o domínio. O teste cria e depois elimina um registo TXT temporário.
      </p>

      <h2>A ter em conta</h2>
      <ul>
        <li>
          O domínio deve utilizar os servidores de nomes da GoDaddy (
          <code>ns*.domaincontrol.com</code>).
        </li>
        <li>
          <b>TTL mínimo: 600 segundos.</b> O local-cert aumenta qualquer valor inferior. Sem
          efeito na emissão dos certificados.
        </li>
      </ul>

      <h2>Se a sua conta não tem acesso à API</h2>
      <p>
        Mantenha o domínio na GoDaddy e delegue apenas o subdomínio da sua rede local num
        fornecedor que o local-cert saiba gerir:
      </p>
      <ol>
        <li>
          Crie uma zona <code>home.example.com</code> na AWS Route53, OVHcloud, Gandi ou Google
          Cloud DNS.
        </li>
        <li>
          No DNS da GoDaddy de <code>example.com</code>, adicione um registo <code>NS</code> por
          servidor de nomes dessa zona, com o nome <code>home</code>.
        </li>
        <li>Declare o fornecedor correspondente e adicione o domínio delegado.</li>
      </ol>

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
                <code>401 UNABLE_TO_AUTHENTICATE</code>
              </td>
              <td>Chave ou segredo errado, ou chave OTE utilizada em produção.</td>
            </tr>
            <tr>
              <td>
                <code>403 ACCESS_DENIED</code>
              </td>
              <td>A conta não cumpre a condição de acesso à API.</td>
            </tr>
            <tr>
              <td>
                <code>422</code> na escrita
              </td>
              <td>Valor recusado pela GoDaddy (TTL, formato): a mensagem indica o campo.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

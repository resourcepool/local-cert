import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function Gandi() {
  return (
    <>
      <h1>Fornecedor Gandi</h1>
      <p className="lead">
        O local-cert gere o Gandi LiveDNS com um Personal Access Token, que se limita aos domínios
        e às permissões estritamente necessários.
      </p>

      <h2>1. Criar o token</h2>
      <ol>
        <li>
          No Gandi: <b>Organizations</b> → a organização proprietária dos domínios →{' '}
          <b>Sharing</b> → <b>Personal Access Tokens</b> → <b>Create a token</b>. Endereço direto:{' '}
          <code>https://admin.gandi.net/organizations/account/pat</code>.
        </li>
        <li>
          <b>Name</b>: <code>local-cert</code>. <b>Expiration</b>: a mais longa que aceitar — no
          termo, as emissões e as renovações param.
        </li>
        <li>
          <b>Resources</b>: restrinja aos domínios que o local-cert deve gerir.
        </li>
        <li>
          <b>Permissions</b>: marque <b>Manage domain technical configurations</b>. As permissões
          de leitura associadas ficam marcadas automaticamente.
        </li>
        <li>
          <b>Create</b> e copie o token: só é mostrado uma vez.
        </li>
      </ol>
      <Callout kind="warn" title="Não a antiga chave de API">
        As antigas «chaves de API» do Gandi (cabeçalho <code>Apikey</code>) estão descontinuadas e
        não são suportadas: é necessário um Personal Access Token.
      </Callout>

      <h2>2. Criar o fornecedor</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Fornecedores</Link> → <b>+ novo fornecedor</b> →{' '}
          <b>Gandi</b>.
        </li>
        <li>Dê um nome e cole o token.</li>
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
          O domínio deve utilizar o <b>LiveDNS</b> (servidores <code>ns-*.gandi.net</code>). Um
          domínio registado no Gandi mas servido por servidores de nomes externos não aparece na
          lista.
        </li>
        <li>
          <b>TTL mínimo: 300 segundos.</b> O local-cert aumenta qualquer valor inferior. Sem
          efeito na emissão dos certificados.
        </li>
        <li>
          Para mudar de token quando o atual estiver perto de expirar:{' '}
          <Link href="/admin/providers">Fornecedores</Link> → <b>editar</b>, cole o novo,{' '}
          <b>Testar</b>, <b>Guardar</b>.
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
                <code>401</code>
              </td>
              <td>Token mal copiado, expirado ou eliminado.</td>
            </tr>
            <tr>
              <td>
                <code>403</code>
              </td>
              <td>
                O token não tem a permissão de configuração técnica, ou o domínio não consta dos
                seus recursos.
              </td>
            </tr>
            <tr>
              <td>A lista de zonas está vazia</td>
              <td>Nenhum domínio do âmbito do token utiliza o LiveDNS.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

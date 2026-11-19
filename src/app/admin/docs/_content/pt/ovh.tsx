import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout } from '../../_lib/prose';

const RIGHTS = `GET    /domain/zone
GET    /domain/zone/*
POST   /domain/zone/*
PUT    /domain/zone/*
DELETE /domain/zone/*`;

export default function Ovh() {
  return (
    <>
      <h1>Fornecedor OVHcloud</h1>
      <p className="lead">
        O local-cert gere as zonas DNS do OVHcloud através da API da OVH, com um conjunto de três
        chaves limitado ao DNS.
      </p>

      <h2>1. Criar o token</h2>
      <p>
        A OVH disponibiliza uma página que cria as três chaves de uma só vez. Abra a da sua região
        com a sessão iniciada na sua conta:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Conta</th>
              <th>Página de criação</th>
              <th>Valor de «Região da API»</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Europa</td>
              <td>
                <code>https://eu.api.ovh.com/createToken/</code>
              </td>
              <td>
                <code>ovh-eu</code>
              </td>
            </tr>
            <tr>
              <td>Canadá</td>
              <td>
                <code>https://ca.api.ovh.com/createToken/</code>
              </td>
              <td>
                <code>ovh-ca</code>
              </td>
            </tr>
            <tr>
              <td>Estados Unidos</td>
              <td>
                <code>https://api.us.ovhcloud.com/createToken/</code>
              </td>
              <td>
                <code>ovh-us</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ol>
        <li>
          <b>Application name</b>: <code>local-cert</code>. Descrição livre.
        </li>
        <li>
          <b>Validity</b>: <b>Unlimited</b>. Um token com duração limitada deixaria de funcionar
          sem aviso, incluindo as renovações.
        </li>
        <li>
          <b>Rights</b>: adicione estas cinco linhas (a ligação proposta pelo assistente do
          local-cert preenche-as previamente):
        </li>
      </ol>
      <CodeBlock title="Permissões a conceder" code={RIGHTS} />
      <ol start={4}>
        <li>
          <b>Create keys</b>. A página mostra a <b>Application Key</b>, a{' '}
          <b>Application Secret</b> e a <b>Consumer Key</b>: anote as três.
        </li>
      </ol>
      <Callout title="Limitar a uma única zona">
        Para dar acesso a um único domínio, substitua <code>*</code> pelo respetivo nome nas
        permissões: <code>/domain/zone/example.com</code> e <code>/domain/zone/example.com/*</code>.
        Mantenha <code>GET /domain/zone</code>, que serve para listar as zonas.
      </Callout>

      <h2>2. Criar o fornecedor</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Fornecedores</Link> → <b>+ novo fornecedor</b> →{' '}
          <b>OVHcloud</b>.
        </li>
        <li>Escolha a região, dê um nome e cole as três chaves.</li>
        <li>
          <b>Testar a ligação</b>: o local-cert lista as suas zonas. Depois, <b>Guardar</b>.
        </li>
      </ol>

      <h2>3. Adicionar um domínio</h2>
      <p>
        <Link href="/admin/domains">Domínios</Link> → <b>+ adicionar um domínio</b> → este
        fornecedor → a zona. O teste cria e depois elimina um registo TXT temporário. Não é
        necessária nenhuma configuração adicional do lado da OVH: as permissões são as do token.
      </p>

      <h2>A ter em conta</h2>
      <ul>
        <li>
          O domínio deve utilizar os <b>servidores DNS da OVH</b> (zona DNS ativa na área de
          cliente). Se os seus servidores de nomes apontarem para outro lado, é esse outro
          fornecedor que deve ser declarado.
        </li>
        <li>
          A OVH só aplica uma alteração após uma «atualização» da zona; o local-cert aciona-a
          depois de cada escrita. A propagação para os servidores secundários pode demorar um a
          dois minutos: é o prazo normal de uma emissão.
        </li>
        <li>TTL mínimo: 60 segundos.</li>
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
                <code>Invalid signature</code>
              </td>
              <td>Application Secret ou Consumer Key mal copiada, ou região errada.</td>
            </tr>
            <tr>
              <td>
                <code>This credential is not valid</code>
              </td>
              <td>Consumer Key expirada ou revogada: volte a criar um token com validade ilimitada.</td>
            </tr>
            <tr>
              <td>
                <code>This call has not been granted</code>
              </td>
              <td>Falta uma linha nas permissões do token.</td>
            </tr>
            <tr>
              <td>
                <code>This application key is invalid</code>
              </td>
              <td>Application Key de outra região.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

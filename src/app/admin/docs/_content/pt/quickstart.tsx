import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, type DocCtx } from '../../_lib/prose';

export default function Quickstart({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Início rápido</h1>
      <p className="lead">
        O local-cert obtém certificados Let&apos;s Encrypt para máquinas que não são acessíveis a
        partir da Internet: NAS, hipervisores, serviços internos. A validação faz-se por DNS
        (DNS-01), pelo que só o local-cert precisa de acesso à sua zona.
      </p>

      <h2>O percurso completo</h2>
      <ol>
        <li>
          <b>Declarar um fornecedor de DNS.</b> É a conta no serviço que aloja a sua zona, com as
          respetivas credenciais: AWS, OVHcloud, Gandi, GoDaddy ou Google Cloud. Página{' '}
          <Link href="/admin/providers">Fornecedores</Link>, guias{' '}
          <Link href="/admin/docs/providers">Fornecedores de DNS</Link>.
        </li>
        <li>
          <b>Adicionar um domínio.</b> Escolhe-se uma zona do fornecedor, o local-cert gera a
          política IAM a colar, testa as permissões e, por fim, guarda. Página{' '}
          <Link href="/admin/domains">Domínios</Link>, guia{' '}
          <Link href="/admin/docs/domains">Adicionar um domínio</Link>.
        </li>
        <li>
          <b>Conceder acesso.</b> Em <Link href="/admin/keys">Chaves e permissões</Link>, crie,
          conforme a necessidade, uma <b>chave de API</b> (scripts, agentes) ou uma{' '}
          <b>credencial EAB</b> (clientes ACME: Traefik, Caddy, certbot…).
        </li>
        <li>
          <b>Emitir.</b> Através do servidor ACME ou da API — ver mais abaixo.
        </li>
      </ol>

      <h2>Que via escolher</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Servidor ACME</th>
              <th>API REST</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Indicado para</td>
              <td>um reverse proxy ou uma ferramenta que já fala ACME</td>
              <td>um script, uma ferramenta sem ACME, um agente (MCP)</td>
            </tr>
            <tr>
              <td>Acesso</td>
              <td>credencial EAB</td>
              <td>chave de API</td>
            </tr>
            <tr>
              <td>Chave privada</td>
              <td>gerada e guardada pelo cliente</td>
              <td>gerada pelo local-cert, cifrada na base de dados</td>
            </tr>
            <tr>
              <td>Renovação</td>
              <td>feita pelo cliente</td>
              <td>feita pelo local-cert (<code>auto_renew</code>)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Via ACME, num só comando</h2>
      <p>
        Com uma credencial EAB autorizada para o domínio, qualquer cliente ACME obtém um
        certificado. Exemplo com o certbot:
      </p>
      <CodeBlock
        title="certbot"
        code={`certbot certonly --standalone -d ${EX.host} \\
  --server ${ctx.directory} \\
  --eab-kid ${EX.kid} --eab-hmac-key ${EX.hmac}`}
      />
      <p>
        O funcionamento e os guias por ferramenta encontram-se em{' '}
        <Link href="/admin/docs/acme">Servidor ACME</Link>.
      </p>

      <h2>Via API, num só pedido</h2>
      <CodeBlock
        title="curl"
        code={`curl -X POST ${ctx.origin}/api/v1/certificates \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H 'content-type: application/json' \\
  -d '{
    "domains": ["${EX.host}"],
    "key_type": "ec-256",
    "auto_renew": true,
    "dns": { "create_record": true, "target_ip": "192.168.1.50" }
  }'`}
      />
      <p>
        A resposta é imediata (<code>202</code>); a emissão demora entre um e três minutos. Todas
        as rotas estão descritas em <Link href="/admin/api">API</Link>.
      </p>

      <Callout title="Durante os testes">
        O selo <code>acme:staging</code> no topo da consola indica que o local-cert está a comunicar
        com o ambiente de testes do Let&apos;s Encrypt: os certificados não são reconhecidos pelos
        navegadores, mas não se consome qualquer quota. Passe a produção depois de validar toda a
        cadeia.
      </Callout>
    </>
  );
}

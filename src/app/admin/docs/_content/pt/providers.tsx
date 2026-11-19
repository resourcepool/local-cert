import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { getMessages } from '@/lib/i18n/server';
import { localizeProvider } from '@/lib/i18n/provider-text';
import { PROVIDER_INFO, PROVIDER_TYPES } from '@/lib/dns/provider-types';
import { Callout } from '../../_lib/prose';

export default async function Providers() {
  const messages = await getMessages();
  return (
    <>
      <h1>Fornecedores de DNS</h1>
      <p className="lead">
        Um fornecedor é uma conta no serviço que aloja as suas zonas DNS, com as credenciais que
        permitem ao local-cert escrever nelas. É por aí que passa a prova exigida pelo Let&apos;s
        Encrypt: um registo TXT colocado durante o tempo da validação.
      </p>

      <h2>Serviços suportados</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Serviço</th>
              <th>Credenciais</th>
              <th>TTL mínimo</th>
              <th>Guia</th>
            </tr>
          </thead>
          <tbody>
            {PROVIDER_TYPES.map((type) => {
              const info = localizeProvider(messages, PROVIDER_INFO[type]);
              return (
                <tr key={type}>
                  <td>{info.label}</td>
                  <td>{info.product}</td>
                  <td>
                    {type === 'aws'
                      ? 'chave IAM, função recomendada'
                      : info.fields
                          .filter((f) => f.required)
                          .map((f) => f.label)
                          .join(', ')}
                  </td>
                  <td>{info.minTtl} s</td>
                  <td>
                    <Link href={`/admin/docs/${info.docs}`}>abrir</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>O princípio, independentemente do fornecedor</h2>
      <ol>
        <li>
          Cria, no fornecedor, credenciais <b>limitadas ao DNS</b> — nunca as da sua conta
          principal.
        </li>
        <li>
          <Link href="/admin/providers">Fornecedores</Link> → <b>+ novo fornecedor</b>: escolhe o
          fornecedor, cola as credenciais, testa e guarda.
        </li>
        <li>
          <Link href="/admin/domains">Domínios</Link> → <b>+ adicionar um domínio</b>: o
          local-cert lista as zonas da conta, escolhe-se uma e ele testa as respetivas permissões.
        </li>
      </ol>
      <p>
        Vários fornecedores do mesmo serviço são o caso normal: um por conta, ou um por âmbito de
        permissões. Os segredos são cifrados na base de dados (AES-256-GCM com{' '}
        <code>MASTER_KEY</code>) e nunca são mostrados de novo nem devolvidos pela API.
      </p>

      <h2>O que difere de um fornecedor para outro</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>AWS Route53</th>
              <th>Os restantes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Permissões</td>
              <td>por zona: uma política IAM que tem de ser atualizada a cada domínio adicionado</td>
              <td>associadas às credenciais: nada a alterar ao adicionar um domínio</td>
            </tr>
            <tr>
              <td>Teste das permissões</td>
              <td>sem qualquer escrita na zona</td>
              <td>
                um registo TXT temporário (<code>_localcert-preflight-…</code>) é criado e depois
                eliminado
              </td>
            </tr>
            <tr>
              <td>Escritas</td>
              <td>atómicas, acompanhadas até à propagação</td>
              <td>registo a registo</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout title="TTL mínimo">
        O Gandi (300 s) e o GoDaddy (600 s) recusam TTL curtos. O local-cert aumenta então
        silenciosamente o valor pedido. Isto não impede a emissão — a validação lê diretamente os
        servidores com autoridade — mas um registo <code>A</code> alterado demorará esse tempo a
        ser visto em toda a parte.
      </Callout>

      <h2>Marcação do que o local-cert cria</h2>
      <p>
        Cada registo publicado a seu pedido é acompanhado de um TXT{' '}
        <code>_local-cert.&lt;nome&gt;</code>: é isso que permite distinguir, na zona, o que vem
        do local-cert do que já existia. A variável <code>TAG_RECORDS=0</code> desativa-o.
      </p>

      <h2>Declarar um fornecedor por variáveis de ambiente</h2>
      <p>
        Quando as credenciais devem vir da implementação e não da base de dados, um fornecedor
        declara-se por variáveis. É facultativo, e o bloco repete-se com outra etiqueta para cada
        conta.
      </p>
      <CodeBlock
        title=".env"
        code={`# PROVIDER_<FORNECEDOR>_<ETIQUETA>_NAME declara o fornecedor; o resto, as suas credenciais
PROVIDER_AWS_DEFAULT_NAME="Default AWS"
PROVIDER_AWS_DEFAULT_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_DEFAULT_SECRET_ACCESS_KEY=…
PROVIDER_AWS_DEFAULT_ROLE_ARN=arn:aws:iam::123456789012:role/local-cert-dns

PROVIDER_OVH_PERSO_NAME="ovh-perso"
PROVIDER_OVH_PERSO_ENDPOINT=ovh-eu
PROVIDER_OVH_PERSO_APPLICATION_KEY=…
PROVIDER_OVH_PERSO_APPLICATION_SECRET=…
PROVIDER_OVH_PERSO_CONSUMER_KEY=…

PROVIDER_GANDI_MAIN_NAME="gandi"
PROVIDER_GANDI_MAIN_TOKEN=…

PROVIDER_GODADDY_MAIN_NAME="godaddy"
PROVIDER_GODADDY_MAIN_API_KEY=…
PROVIDER_GODADDY_MAIN_API_SECRET=…

PROVIDER_GCP_MAIN_NAME="gcp"
PROVIDER_GCP_MAIN_SERVICE_ACCOUNT_JSON=<o JSON da chave, ou a sua codificação base64>
PROVIDER_GCP_MAIN_PROJECT_ID=o-meu-projeto   # facultativo`}
      />
      <ul>
        <li>
          A etiqueta (<code>DEFAULT</code>, <code>PERSO</code>, <code>MAIN</code>…) é livre:
          letras maiúsculas, algarismos e sublinhados.
        </li>
        <li>
          Estes fornecedores aparecem na consola com a menção <i>ambiente</i>. Podem ser testados,
          mas não alterados nem removidos: isso faz-se nas variáveis, seguido de um reinício. Os
          seus segredos nunca são escritos na base de dados.
        </li>
        <li>
          Uma declaração incompleta é ignorada, com uma mensagem no arranque que indica a variável
          em falta.
        </li>
      </ul>
    </>
  );
}

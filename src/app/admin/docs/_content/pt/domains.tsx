import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function Domains() {
  return (
    <>
      <h1>Adicionar um domínio</h1>
      <p className="lead">
        Um domínio gerido é um nome de base — <code>home.example.com</code> — sob o qual o
        local-cert tem autorização para emitir. Assenta numa zona alojada num fornecedor. O
        assistente da página <Link href="/admin/domains">Domínios</Link> trata de tudo em três
        ecrãs.
      </p>

      <h2>Antes de começar</h2>
      <ul>
        <li>
          Um <Link href="/admin/docs/providers">fornecedor</Link> registado, cujo teste esteja
          a verde.
        </li>
        <li>
          Uma zona <b>pública</b> nesse fornecedor, com autoridade sobre o nome. O Let&apos;s Encrypt
          tem de conseguir ler o registo de validação a partir da Internet: uma zona privada não
          serve, mesmo que os seus anfitriões continuem privados.
        </li>
      </ul>
      <Callout title="Dedicar uma zona à LAN">
        Não é obrigatório expor a sua zona principal. Crie uma zona Route53 para{' '}
        <code>home.example.com</code> e delegue-a a partir de <code>example.com</code> com quatro
        registos <code>NS</code>: o local-cert só terá permissões sobre esse subdomínio, qualquer
        que seja o fornecedor da zona principal.
      </Callout>

      <h2>1. Escolher o fornecedor</h2>
      <p>
        <b>+ adicionar um domínio</b> e, em seguida, selecione o fornecedor. O local-cert consulta
        a conta e mostra o número de zonas visíveis.
      </p>

      <h2>2. Escolher a zona</h2>
      <p>
        As zonas da conta são listadas com o respetivo identificador. Uma zona privada aparece a
        cinzento. Se uma zona já tiver um domínio gerido, isso é indicado.
      </p>
      <ul>
        <li>
          <b>Nome de base</b>: por omissão, o nome da zona. Pode restringi-lo a um subdomínio
          (<code>lab.home.example.com</code> na zona <code>home.example.com</code>): só os nomes
          situados abaixo poderão receber um certificado.
        </li>
        <li>
          <b>TTL por omissão</b>: tempo de vida dos registos que o local-cert publica. 60
          segundos são adequados.
        </li>
      </ul>

      <h2>3. Conceder as permissões, testar, adicionar</h2>
      <p>
        O local-cert testa de imediato as suas permissões sobre a zona. Se já estiverem
        concedidas, basta confirmar. Caso contrário, o ecrã indica o que fazer:
      </p>
      <ol>
        <li>
          Na consola da AWS, abra a função (ou o utilizador) indicada → separador{' '}
          <b>Permissions</b>.
        </li>
        <li>
          Clique na política <b>já existente</b>, <code>local-cert-route53</code> — a que foi
          criada com o fornecedor — e depois em <b>Edit</b> → separador <b>JSON</b>. Não adicione
          uma segunda política: é esta que deve evoluir.
        </li>
        <li>
          Substitua todo o conteúdo pelo documento apresentado e clique em <b>Next</b> →{' '}
          <b>Save changes</b>. Esse documento contém as zonas já declaradas neste fornecedor{' '}
          <b>mais</b> a nova: nada é retirado.
        </li>
        <li>
          Volte ao assistente e clique em <b>Retestar</b>.
        </li>
        <li>
          Quando todas as linhas obrigatórias estiverem em <code>OK</code>, clique em{' '}
          <b>Adicionar o domínio</b>.
        </li>
      </ol>

      <h3>Adicionar sem esperar: o estado «pendente»</h3>
      <p>
        Um fornecedor pode demorar alguns minutos a aplicar uma alteração de permissões. Em vez
        de retestar manualmente, adicione o domínio enquanto o teste ainda falha (botão{' '}
        <b>Adicionar como pendente</b>):
      </p>
      <ul>
        <li>
          o domínio fica <b>pendente</b>: o local-cert repete o teste todos os minutos, até cinco
          vezes, e passa-o a <b>ativo</b> assim que tiver êxito;
        </li>
        <li>
          após cinco falhas passa a <b>erro</b>, com a última recusa visível. Corrija as
          permissões e clique em <b>repetir a verificação</b>: começa um novo ciclo;
        </li>
        <li>
          enquanto não estiver ativo, o domínio não recebe certificados nem registos: a API
          responde <code>409</code> e o servidor ACME responde <code>rejectedIdentifier</code>.
        </li>
      </ul>

      <Callout title="Fora da AWS, este passo é mais curto">
        No OVHcloud, Gandi, GoDaddy e Google Cloud, as permissões estão associadas às credenciais
        do fornecedor: não há política para colar, apenas o teste. Este cria e depois elimina um
        registo TXT temporário na zona. Os passos acima e a tabela abaixo descrevem o caso da AWS.
      </Callout>

      <h3>O que o teste verifica</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Chamada</th>
              <th>Obrigatória</th>
              <th>Serve para</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ListResourceRecordSets</code>
              </td>
              <td>sim</td>
              <td>ler a zona e verificar que cobre o nome de base</td>
            </tr>
            <tr>
              <td>
                <code>GetHostedZone</code>
              </td>
              <td>sim</td>
              <td>encontrar os servidores de nomes a consultar durante a validação</td>
            </tr>
            <tr>
              <td>
                <code>GetChange</code>
              </td>
              <td>sim</td>
              <td>aguardar a propagação de uma escrita</td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code> (TXT)
              </td>
              <td>sim</td>
              <td>escrever o registo de validação</td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code> (A)
              </td>
              <td>não</td>
              <td>publicar o endereço de um anfitrião, se o pedir na emissão</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        A permissão de escrita é sondada através da eliminação de um registo que não existe: a AWS
        verifica a autorização antes de constatar que não há nada a eliminar.{' '}
        <b>A zona nunca é alterada pelo teste.</b>
      </p>

      <h3>Se o teste continuar vermelho</h3>
      <ul>
        <li>
          Aguarde alguns segundos e volte a testar: o IAM não propaga instantaneamente.
        </li>
        <li>
          Verifique se a política foi colada na identidade indicada, e não no utilizador quando o
          fornecedor passa por uma função.
        </li>
        <li>
          Se todas as linhas falharem com a mesma mensagem, o problema é o próprio fornecedor:
          botão <b>testar</b> em <Link href="/admin/providers">Fornecedores</Link>.
        </li>
        <li>
          Se existir um registo <code>CAA</code> na zona, deve autorizar{' '}
          <code>letsencrypt.org</code> — o teste não o verifica, mas a emissão falhará.
        </li>
      </ul>
      <p>
        <b>Adicionar mesmo assim</b> regista um domínio cujo teste falha. É útil para preparar
        uma configuração; nenhuma emissão será bem-sucedida enquanto faltarem as permissões.
      </p>

      <h2>A seguir</h2>
      <ul>
        <li>
          Conceda acesso ao domínio em <Link href="/admin/keys">Chaves e permissões</Link>: uma
          chave de API com as respetivas permissões, ou uma credencial EAB para um cliente ACME.
        </li>
        <li>
          Emita um primeiro certificado: <Link href="/admin/docs">Início rápido</Link>.
        </li>
      </ul>

      <h2>Remover um domínio</h2>
      <p>
        <b>remover</b> é recusado enquanto existirem certificados. <b>forçar</b> revoga-os, limpa
        a zona tanto quanto possível e elimina tudo. Lembre-se depois de regenerar a política do
        fornecedor (botão <b>política</b>) e de a colar de novo na AWS: a zona removida deixa de
        constar dela.
      </p>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EabValues, type DocCtx } from '../../_lib/prose';

export default function Acme({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Servidor ACME</h1>
      <p className="lead">
        O local-cert expõe um ponto de entrada ACME (RFC 8555) em <code>/acme/directory</code>.
        Qualquer ferramenta capaz de pedir um certificado ao Let&apos;s Encrypt pode pedi-lo ao
        local-cert, para anfitriões que o Let&apos;s Encrypt nunca poderia alcançar.
      </p>
      <CodeBlock title="Directory desta instância" code={ctx.directory} />

      <h2>O que é, e o que não é</h2>
      <p>
        Não é uma autoridade de certificação. O local-cert não assina nada: serve de intermediário
        entre o seu cliente ACME e o Let&apos;s Encrypt, e o certificado que recebe é um verdadeiro
        certificado Let&apos;s Encrypt, reconhecido em toda a parte.
      </p>
      <p>
        O problema que resolve: um cliente ACME clássico prova que controla um nome respondendo na
        porta 80 (HTTP-01), o que pressupõe que o Let&apos;s Encrypt consiga alcançar a máquina.
        Numa LAN, isso é impossível. A prova por DNS (DNS-01) funciona, mas obriga a dar
        credenciais DNS a cada máquina. O local-cert guarda essas credenciais para si e faz a
        prova DNS em vez do cliente.
      </p>

      <h2>Como é emitido um certificado</h2>
      <ol>
        <li>
          <b>Registo.</b> O cliente cria a sua conta ACME apresentando uma credencial EAB. Uma
          única vez; depois assina com a sua própria chave de conta.
        </li>
        <li>
          <b>Pedido.</b> O cliente pede um certificado para um ou mais nomes. O local-cert verifica
          se pertencem a um domínio gerido e se a credencial EAB tem direito a eles. Caso
          contrário, o pedido é recusado de imediato.
        </li>
        <li>
          <b>Desafio.</b> O local-cert propõe um desafio HTTP-01, como uma CA normal. O cliente
          prepara a sua resposta e sinaliza que está pronto.
        </li>
        <li>
          <b>Validação real.</b> O local-cert nunca vai buscar a resposta HTTP. Em vez disso, abre
          um pedido no Let&apos;s Encrypt, escreve o registo TXT <code>_acme-challenge</code> na
          sua zona, aguarda a propagação, faz validar e depois elimina o registo. O desafio do
          cliente passa a <code>valid</code> quando termina.
        </li>
        <li>
          <b>Finalização.</b> O cliente envia o seu CSR. O local-cert transmite-o ao Let&apos;s
          Encrypt e devolve a cadeia de certificados. A chave privada nunca saiu do cliente.
        </li>
      </ol>
      <Callout title="Consequências práticas">
        <ul>
          <li>
            A porta 80 do cliente não precisa de estar acessível, nem pelo local-cert nem pela
            Internet. O cliente só tem de conseguir contactar o local-cert por HTTP(S).
          </li>
          <li>
            O passo 4 demora entre um e três minutos: é o tempo da propagação DNS. Os clientes
            esperam por si próprios; não reduza os respetivos tempos limite.
          </li>
          <li>
            Só é proposto o HTTP-01. Um cliente configurado apenas para DNS-01 ou TLS-ALPN-01 não
            encontrará um desafio compatível.
          </li>
        </ul>
      </Callout>

      <h2>As credenciais EAB</h2>
      <p>
        EAB significa <i>External Account Binding</i>. É o mecanismo previsto pelo ACME para que
        uma CA só aceite os clientes que já conhece: ao criar a conta, o cliente prova que possui
        um segredo entregue previamente. Aqui, é o que substitui a chave de API.
      </p>
      <p>Uma credencial EAB é composta por dois valores, mais o URL do servidor:</p>
      <EabValues ctx={ctx} />
      <p>
        Cria-se em <Link href="/admin/keys">Chaves e permissões</Link> →{' '}
        <b>Credenciais EAB</b> → <b>+ nova credencial</b>, com:
      </p>
      <ul>
        <li>
          um <b>nome</b>, para saber a que cliente foi entregue;
        </li>
        <li>
          uma <b>expiração</b> facultativa;
        </li>
        <li>
          os <b>domínios autorizados</b>: o cliente só pode pedir certificados abaixo destes.
        </li>
      </ul>
      <h3>O que convém saber</h3>
      <ul>
        <li>
          A chave HMAC só é mostrada uma vez. Se for perdida, é necessário criar uma nova
          credencial.
        </li>
        <li>
          O cliente só a utiliza no registo, mas o local-cert volta a ler a credencial a cada
          pedido: <b>revogá-la</b> ou deixá-la <b>expirar</b> corta também os clientes já
          registados.
        </li>
        <li>
          Uma credencial pode servir vários clientes. Uma credencial por cliente permite cortá-los
          separadamente e saber quem emitiu o quê.
        </li>
        <li>
          A chave está codificada em base64url, o formato esperado por todos os clientes (
          <code>hmacEncoded</code>, <code>--eab-hmac-key</code>, <code>mac_key</code>…).
        </li>
      </ul>

      <h2>O que o cliente deve saber fazer</h2>
      <p>Três coisas, que quase todos os clientes ACME modernos oferecem:</p>
      <ol>
        <li>utilizar um URL de directory personalizado;</li>
        <li>registar-se com um External Account Binding;</li>
        <li>resolver um desafio HTTP-01.</li>
      </ol>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ferramenta</th>
              <th>Suporte</th>
              <th>Guia</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Traefik', 'nativo', 'acme/traefik'],
              ['Caddy', 'nativo', 'acme/caddy'],
              ['Apache httpd', 'nativo (mod_md)', 'acme/apache'],
              ['Nginx', 'através do certbot ou do acme.sh', 'acme/nginx'],
              ['HAProxy', 'através do acme.sh', 'acme/haproxy'],
              ['Nginx Proxy Manager', 'importação manual', 'acme/nginx-proxy-manager'],
              ['Kubernetes', 'nativo (cert-manager)', 'acme/kubernetes'],
              ['Dokploy', 'nativo (Traefik)', 'acme/dokploy'],
              ['Coolify', 'nativo (Traefik)', 'acme/coolify'],
              ['Synology DSM', 'através do acme.sh', 'acme/synology'],
              ['Proxmox VE', 'nativo (pvenode)', 'acme/proxmox'],
              ['certbot, acme.sh, lego', 'nativo', 'acme/clients'],
            ].map(([tool, support, slug]) => (
              <tr key={slug}>
                <td>{tool}</td>
                <td>{support}</td>
                <td>
                  <Link href={`/admin/docs/${slug}`}>abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Para tudo o resto, ver <Link href="/admin/docs/acme/others">Outros sistemas</Link>.
      </p>

      <h2>Regras e limites</h2>
      <ul>
        <li>
          Um nome fora dos domínios geridos é recusado (<code>rejectedIdentifier</code>); um
          domínio não autorizado para a credencial também (<code>unauthorized</code>).
        </li>
        <li>Todos os nomes de um mesmo pedido têm de pertencer ao mesmo domínio gerido.</li>
        <li>
          Os carateres universais (<code>*.home.example.com</code>) são aceites: como a validação
          real é feita em DNS-01, a restrição habitual do HTTP-01 não se aplica. Alguns clientes
          recusam, porém, por si próprios um caráter universal em HTTP-01.
        </li>
        <li>
          Estes certificados aparecem em <Link href="/admin/certificates">Certificados</Link> com
          o tipo de chave <code>external</code>, sem chave privada nem renovação automática: é o
          cliente que renova.
        </li>
        <li>
          Uma conta ACME pode revogar os certificados que obteve. A rotação da chave da conta (
          <code>keyChange</code>) não está implementada.
        </li>
      </ul>

      <h2>Resolução de problemas</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sintoma</th>
              <th>Causa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>JWS &quot;url&quot; is … but this endpoint is …</code>
              </td>
              <td>
                O local-cert está atrás de um proxy que não transmite{' '}
                <code>X-Forwarded-Proto</code> / <code>X-Forwarded-Host</code>. Transmita-os ou
                defina a variável <code>PUBLIC_URL</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>externalAccountRequired</code>
              </td>
              <td>O cliente regista-se sem EAB. Verifique a sua configuração.</td>
            </tr>
            <tr>
              <td>
                <code>unauthorized</code> no registo
              </td>
              <td>Credencial desconhecida, revogada ou expirada, ou chave HMAC errada.</td>
            </tr>
            <tr>
              <td>
                <code>rejectedIdentifier</code>
              </td>
              <td>O nome pedido não está abaixo de nenhum domínio gerido.</td>
            </tr>
            <tr>
              <td>O cliente desiste ao fim de ~1 minuto</td>
              <td>
                O seu tempo limite é mais curto do que a validação DNS. Volte a executar: o pedido
                em curso é retomado.
              </td>
            </tr>
            <tr>
              <td>Erro TLS para o local-cert</td>
              <td>
                O local-cert é servido com um certificado que o cliente não reconhece. Sirva-o com
                um certificado público, ou adicione a sua CA ao repositório de certificados do
                cliente.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Traefik({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Traefik</h1>
      <p className="lead">
        O Traefik (v2 e v3) suporta uma CA personalizada e o EAB nos seus resolvers de
        certificados. Basta declarar um que aponte para o local-cert.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Declarar o resolver</h2>
      <p>Na configuração estática, em ficheiro:</p>
      <CodeBlock
        title="traefik.yml"
        code={`entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

certificatesResolvers:
  localcert:
    acme:
      caServer: ${ctx.directory}
      email: ${EX.email}
      storage: /letsencrypt/localcert.json
      eab:
        kid: ${EX.kid}
        hmacEncoded: ${EX.hmac}
      httpChallenge:
        entryPoint: web`}
      />
      <p>ou em argumentos, para um contentor:</p>
      <CodeBlock
        title="docker-compose.yml (excerto)"
        code={`services:
  traefik:
    image: traefik:v3
    command:
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --providers.docker=true
      - --certificatesresolvers.localcert.acme.caserver=${ctx.directory}
      - --certificatesresolvers.localcert.acme.email=${EX.email}
      - --certificatesresolvers.localcert.acme.storage=/letsencrypt/localcert.json
      - --certificatesresolvers.localcert.acme.eab.kid=${EX.kid}
      - --certificatesresolvers.localcert.acme.eab.hmacencoded=${EX.hmac}
      - --certificatesresolvers.localcert.acme.httpchallenge.entrypoint=web
    volumes:
      - ./letsencrypt:/letsencrypt
      - /var/run/docker.sock:/var/run/docker.sock:ro`}
      />
      <Callout kind="warn" title="Um ficheiro de armazenamento por CA">
        Dê a este resolver o seu próprio ficheiro <code>storage</code>. Reutilizar o{' '}
        <code>acme.json</code> de um resolver Let&apos;s Encrypt existente mistura duas contas
        ACME e faz falhar o registo.
      </Callout>

      <h2>2. Utilizá-lo num router</h2>
      <CodeBlock
        title="labels do serviço"
        code={`labels:
  - traefik.enable=true
  - traefik.http.routers.nas.rule=Host(\`${EX.host}\`)
  - traefik.http.routers.nas.entrypoints=websecure
  - traefik.http.routers.nas.tls.certresolver=localcert`}
      />
      <p>
        O Traefik pede o certificado no primeiro arranque do router e depois renova-o sozinho (30
        dias antes do termo, por omissão).
      </p>

      <h2>A ter em conta</h2>
      <ul>
        <li>
          O entrypoint indicado em <code>httpChallenge</code> tem de existir, mas não receberá
          qualquer pedido de validação: não é necessário expô-lo fora da LAN.
        </li>
        <li>
          A emissão demora entre um e três minutos. Durante esse tempo, o Traefik serve o seu
          certificado por omissão; é normal.
        </li>
        <li>
          Para um caráter universal, declare os nomes no router com{' '}
          <code>tls.domains[0].main</code> / <code>sans</code>. Se o Traefik recusar o caráter
          universal em HTTP-01, emita-o pela <Link href="/admin/api">API</Link>.
        </li>
        <li>
          Em caso de falha, os registos do Traefik ao nível <code>DEBUG</code> reproduzem o erro
          ACME devolvido pelo local-cert — ver a tabela de resolução de problemas em{' '}
          <Link href="/admin/docs/acme">Servidor ACME</Link>.
        </li>
      </ul>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Dokploy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Dokploy</h1>
      <p className="lead">
        O Dokploy encaminha tudo pelo Traefik. Acrescenta-se-lhe um segundo resolver de
        certificados, ao lado do do Let&apos;s Encrypt, e escolhe-se depois domínio a domínio.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Adicionar o resolver</h2>
      <p>
        No Dokploy: <b>Web Server</b> → <b>Traefik</b> → editar a configuração principal
        (ficheiro <code>/etc/dokploy/traefik/traefik.yml</code> no servidor). Em{' '}
        <code>certificatesResolvers</code>, mantenha <code>letsencrypt</code> e acrescente:
      </p>
      <CodeBlock
        title="traefik.yml (excerto)"
        code={`certificatesResolvers:
  letsencrypt:
    # … inalterado …
  localcert:
    acme:
      caServer: ${ctx.directory}
      email: ${EX.email}
      storage: /etc/dokploy/traefik/dynamic/acme-localcert.json
      eab:
        kid: ${EX.kid}
        hmacEncoded: ${EX.hmac}
      httpChallenge:
        entryPoint: web`}
      />
      <p>
        Guarde e recarregue o Traefik a partir da mesma página (<b>Reload</b>). A configuração
        estática só é relida quando o Traefik reinicia.
      </p>

      <h2>2. Utilizá-lo num domínio</h2>
      <ol>
        <li>
          Na aplicação → <b>Domains</b> → adicione <code>{EX.host}</code>.
        </li>
        <li>
          Ative o <b>HTTPS</b>.
        </li>
        <li>
          Fornecedor de certificado: <b>Custom</b>, resolver <code>localcert</code>.
        </li>
      </ol>
      <Callout title="Sem a opção «Custom»?">
        Nas versões do Dokploy que só oferecem <i>None</i> e <i>Let&apos;s Encrypt</i>, há duas
        soluções: atualizar o Dokploy, ou editar em <b>Traefik</b> → ficheiros dinâmicos o router
        da aplicação, substituindo <code>certResolver: letsencrypt</code> por{' '}
        <code>certResolver: localcert</code>.
      </Callout>

      <h2>3. O DNS</h2>
      <p>
        <code>{EX.host}</code> deve apontar para o endereço LAN do servidor Dokploy. O local-cert
        pode publicar esse registo <code>A</code> por si: ver <b>DNS</b> na{' '}
        <Link href="/admin/api">API</Link>.
      </p>

      <h2>A ter em conta</h2>
      <ul>
        <li>
          Os domínios públicos das suas outras aplicações permanecem em <code>letsencrypt</code>:
          os dois resolvers coabitam.
        </li>
        <li>
          Mantenha um ficheiro <code>storage</code> distinto por resolver, como acima.
        </li>
        <li>
          O resto do comportamento é o do Traefik: ver{' '}
          <Link href="/admin/docs/acme/traefik">Traefik</Link>.
        </li>
      </ul>
    </>
  );
}

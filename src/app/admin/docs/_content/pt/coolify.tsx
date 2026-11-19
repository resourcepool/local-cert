import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Coolify({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Coolify</h1>
      <p className="lead">
        O proxy predefinido do Coolify é o Traefik, configurado por argumentos. Acrescenta-se-lhe
        um resolver para o local-cert e indica-se depois nas labels das aplicações em causa.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Adicionar o resolver</h2>
      <p>
        <b>Servers</b> → o seu servidor → <b>Proxy</b> → <b>Configuration</b>. Na secção{' '}
        <code>command</code> do serviço Traefik, a seguir às linhas{' '}
        <code>--certificatesresolvers.letsencrypt…</code>, acrescente:
      </p>
      <CodeBlock
        title="configuração do proxy (excerto)"
        code={`      - '--certificatesresolvers.localcert.acme.caserver=${ctx.directory}'
      - '--certificatesresolvers.localcert.acme.email=${EX.email}'
      - '--certificatesresolvers.localcert.acme.storage=/traefik/acme-localcert.json'
      - '--certificatesresolvers.localcert.acme.eab.kid=${EX.kid}'
      - '--certificatesresolvers.localcert.acme.eab.hmacencoded=${EX.hmac}'
      - '--certificatesresolvers.localcert.acme.httpchallenge.entrypoint=http'`}
      />
      <p>
        Guarde e depois <b>Restart Proxy</b>. No Coolify, os entrypoints chamam-se{' '}
        <code>http</code> e <code>https</code>.
      </p>

      <h2>2. Utilizá-lo numa aplicação</h2>
      <ol>
        <li>
          Atribua à aplicação o domínio <code>https://{EX.host}</code>.
        </li>
        <li>
          Nas suas definições, desmarque a opção que torna as labels do contentor só de leitura.
        </li>
        <li>
          Nas labels, substitua <code>certresolver=letsencrypt</code> por{' '}
          <code>certresolver=localcert</code> no router HTTPS.
        </li>
        <li>Volte a implementar.</li>
      </ol>
      <CodeBlock
        title="label esperada"
        code={`traefik.http.routers.https-0-xxxxxxxx.tls.certresolver=localcert`}
      />

      <Callout title="Todo o servidor no local-cert">
        Se este servidor só aloja serviços internos, é mais simples não alterar nada nas labels e
        redirecionar o próprio resolver <code>letsencrypt</code>: acrescente as linhas{' '}
        <code>caserver</code>, <code>eab.kid</code> e <code>eab.hmacencoded</code> a esse
        resolver, elimine o respetivo <code>acme.json</code> existente e reinicie o proxy.
      </Callout>

      <h2>A ter em conta</h2>
      <ul>
        <li>
          Se o proxy do servidor for o Caddy, siga antes o guia{' '}
          <Link href="/admin/docs/acme/caddy">Caddy</Link>.
        </li>
        <li>
          Uma regeneração das labels pelo Coolify repõe <code>letsencrypt</code>: é por isso que o
          modo só de leitura deve permanecer desativado nestas aplicações.
        </li>
      </ul>
    </>
  );
}

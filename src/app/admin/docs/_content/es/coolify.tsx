import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Coolify({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Coolify</h1>
      <p className="lead">
        El proxy predeterminado de Coolify es Traefik, configurado mediante argumentos. Se le
        añade un resolver para local-cert y después se indica en las etiquetas (labels) de las
        aplicaciones afectadas.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Añadir el resolver</h2>
      <p>
        <b>Servers</b> → su servidor → <b>Proxy</b> → <b>Configuration</b>. En la sección{' '}
        <code>command</code> del servicio Traefik, a continuación de las líneas{' '}
        <code>--certificatesresolvers.letsencrypt…</code>, añada:
      </p>
      <CodeBlock
        title="configuración del proxy (extracto)"
        code={`      - '--certificatesresolvers.localcert.acme.caserver=${ctx.directory}'
      - '--certificatesresolvers.localcert.acme.email=${EX.email}'
      - '--certificatesresolvers.localcert.acme.storage=/traefik/acme-localcert.json'
      - '--certificatesresolvers.localcert.acme.eab.kid=${EX.kid}'
      - '--certificatesresolvers.localcert.acme.eab.hmacencoded=${EX.hmac}'
      - '--certificatesresolvers.localcert.acme.httpchallenge.entrypoint=http'`}
      />
      <p>
        Guarde y pulse <b>Restart Proxy</b>. En Coolify, los entrypoints se llaman{' '}
        <code>http</code> y <code>https</code>.
      </p>

      <h2>2. Usarlo en una aplicación</h2>
      <ol>
        <li>
          Asigne a la aplicación el dominio <code>https://{EX.host}</code>.
        </li>
        <li>
          En sus ajustes, desmarque la opción que deja las etiquetas del contenedor en solo
          lectura.
        </li>
        <li>
          En las etiquetas, sustituya <code>certresolver=letsencrypt</code> por{' '}
          <code>certresolver=localcert</code> en el router HTTPS.
        </li>
        <li>Vuelva a desplegar.</li>
      </ol>
      <CodeBlock
        title="etiqueta esperada"
        code={`traefik.http.routers.https-0-xxxxxxxx.tls.certresolver=localcert`}
      />

      <Callout title="Todo el servidor con local-cert">
        Si este servidor solo aloja servicios internos, es más sencillo no tocar las etiquetas y
        redirigir el propio resolver <code>letsencrypt</code>: añada las líneas{' '}
        <code>caserver</code>, <code>eab.kid</code> y <code>eab.hmacencoded</code> a ese
        resolver, elimine su <code>acme.json</code> existente y reinicie el proxy.
      </Callout>

      <h2>Conviene saber</h2>
      <ul>
        <li>
          Si el proxy del servidor es Caddy, siga en su lugar la guía de{' '}
          <Link href="/admin/docs/acme/caddy">Caddy</Link>.
        </li>
        <li>
          Si Coolify regenera las etiquetas, vuelve a poner <code>letsencrypt</code>: por eso el
          modo de solo lectura debe permanecer desactivado en estas aplicaciones.
        </li>
      </ul>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Dokploy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Dokploy</h1>
      <p className="lead">
        Dokploy enruta todo a través de Traefik. Se le añade un segundo resolver de certificados,
        junto al de Let&apos;s Encrypt, y se elige dominio por dominio.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Añadir el resolver</h2>
      <p>
        En Dokploy: <b>Web Server</b> → <b>Traefik</b> → modifique la configuración principal
        (archivo <code>/etc/dokploy/traefik/traefik.yml</code> en el servidor). Bajo{' '}
        <code>certificatesResolvers</code>, conserve <code>letsencrypt</code> y añada:
      </p>
      <CodeBlock
        title="traefik.yml (extracto)"
        code={`certificatesResolvers:
  letsencrypt:
    # … sin cambios …
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
        Guarde y recargue Traefik desde la misma página (<b>Reload</b>). La configuración
        estática solo se vuelve a leer cuando Traefik se reinicia.
      </p>

      <h2>2. Usarlo en un dominio</h2>
      <ol>
        <li>
          En la aplicación → <b>Domains</b> → añada <code>{EX.host}</code>.
        </li>
        <li>
          Active <b>HTTPS</b>.
        </li>
        <li>
          Proveedor de certificado: <b>Custom</b>, resolver <code>localcert</code>.
        </li>
      </ol>
      <Callout title="¿No aparece la opción «Custom»?">
        En las versiones de Dokploy que solo ofrecen <i>None</i> y <i>Let&apos;s Encrypt</i> hay
        dos soluciones: actualizar Dokploy, o editar en <b>Traefik</b> → archivos dinámicos el
        router de la aplicación para sustituir <code>certResolver: letsencrypt</code> por{' '}
        <code>certResolver: localcert</code>.
      </Callout>

      <h2>3. El DNS</h2>
      <p>
        <code>{EX.host}</code> debe apuntar a la dirección LAN del servidor Dokploy. local-cert
        puede publicar ese registro <code>A</code> por usted: consulte <b>DNS</b> en la{' '}
        <Link href="/admin/api">API</Link>.
      </p>

      <h2>Conviene saber</h2>
      <ul>
        <li>
          Los dominios públicos de sus demás aplicaciones siguen con <code>letsencrypt</code>: los
          dos resolvers conviven.
        </li>
        <li>
          Mantenga un archivo <code>storage</code> distinto por resolver, como arriba.
        </li>
        <li>
          El resto del comportamiento es el de Traefik: consulte{' '}
          <Link href="/admin/docs/acme/traefik">Traefik</Link>.
        </li>
      </ul>
    </>
  );
}

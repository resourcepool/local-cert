import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Traefik({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Traefik</h1>
      <p className="lead">
        Traefik (v2 y v3) admite una CA personalizada y EAB en sus resolvers de certificados.
        Basta con declarar uno que apunte a local-cert.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Declarar el resolver</h2>
      <p>En la configuración estática, en archivo:</p>
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
      <p>o mediante argumentos, para un contenedor:</p>
      <CodeBlock
        title="docker-compose.yml (extracto)"
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
      <Callout kind="warn" title="Un archivo de almacenamiento por CA">
        Asigne a este resolver su propio archivo <code>storage</code>. Reutilizar el{' '}
        <code>acme.json</code> de un resolver de Let&apos;s Encrypt existente mezcla dos cuentas
        ACME y hace fallar el registro.
      </Callout>

      <h2>2. Usarlo en un router</h2>
      <CodeBlock
        title="labels del servicio"
        code={`labels:
  - traefik.enable=true
  - traefik.http.routers.nas.rule=Host(\`${EX.host}\`)
  - traefik.http.routers.nas.entrypoints=websecure
  - traefik.http.routers.nas.tls.certresolver=localcert`}
      />
      <p>
        Traefik solicita el certificado en el primer arranque del router y después lo renueva por
        sí solo (30 días antes del vencimiento por defecto).
      </p>

      <h2>Conviene saber</h2>
      <ul>
        <li>
          El entrypoint designado en <code>httpChallenge</code> debe existir, pero no recibirá
          ninguna petición de validación: no es necesario exponerlo fuera de la LAN.
        </li>
        <li>
          La emisión tarda de uno a tres minutos. Durante ese tiempo Traefik sirve su certificado
          por defecto; es normal.
        </li>
        <li>
          Para un comodín, declare los nombres en el router con <code>tls.domains[0].main</code>{' '}
          / <code>sans</code>. Si Traefik rechaza el comodín en HTTP-01, emítalo mediante la{' '}
          <Link href="/admin/api">API</Link>.
        </li>
        <li>
          En caso de fallo, los registros de Traefik en nivel <code>DEBUG</code> reproducen el
          error ACME devuelto por local-cert; consulte la tabla de solución de problemas en{' '}
          <Link href="/admin/docs/acme">Servidor ACME</Link>.
        </li>
      </ul>
    </>
  );
}

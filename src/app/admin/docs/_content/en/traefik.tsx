import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Traefik({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Traefik</h1>
      <p className="lead">
        Traefik (v2 and v3) supports a custom CA and EAB in its certificate resolvers. All you need
        is to declare one that points to local-cert.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Declare the resolver</h2>
      <p>In the static configuration, as a file:</p>
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
      <p>or as arguments, for a container:</p>
      <CodeBlock
        title="docker-compose.yml (excerpt)"
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
      <Callout kind="warn" title="One storage file per CA">
        Give this resolver its own <code>storage</code> file. Reusing the <code>acme.json</code> of
        an existing Let&apos;s Encrypt resolver mixes two ACME accounts and makes registration
        fail.
      </Callout>

      <h2>2. Use it on a router</h2>
      <CodeBlock
        title="service labels"
        code={`labels:
  - traefik.enable=true
  - traefik.http.routers.nas.rule=Host(\`${EX.host}\`)
  - traefik.http.routers.nas.entrypoints=websecure
  - traefik.http.routers.nas.tls.certresolver=localcert`}
      />
      <p>
        Traefik requests the certificate the first time the router starts, then renews it on its
        own (30 days before expiry by default).
      </p>

      <h2>Good to know</h2>
      <ul>
        <li>
          The entrypoint named in <code>httpChallenge</code> must exist, but it will receive no
          validation request: there is no need to expose it outside the LAN.
        </li>
        <li>
          Issuance takes one to three minutes. In the meantime Traefik serves its default
          certificate; this is normal.
        </li>
        <li>
          For a wildcard, declare the names on the router with <code>tls.domains[0].main</code> /{' '}
          <code>sans</code>. If Traefik refuses the wildcard over HTTP-01, issue it through the{' '}
          <Link href="/admin/api">API</Link>.
        </li>
        <li>
          On failure, Traefik&apos;s logs at <code>DEBUG</code> level reproduce the ACME error
          returned by local-cert — see the troubleshooting table in{' '}
          <Link href="/admin/docs/acme">ACME server</Link>.
        </li>
      </ul>
    </>
  );
}

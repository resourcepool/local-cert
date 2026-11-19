import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Traefik({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Traefik</h1>
      <p className="lead">
        Traefik (v2 und v3) unterstützt in seinen Zertifikats-Resolvern eine benutzerdefinierte CA
        und EAB. Es genügt, einen Resolver zu deklarieren, der auf local-cert zeigt.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Den Resolver deklarieren</h2>
      <p>In der statischen Konfiguration, als Datei:</p>
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
      <p>oder als Argumente, für einen Container:</p>
      <CodeBlock
        title="docker-compose.yml (Auszug)"
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
      <Callout kind="warn" title="Eine Speicherdatei pro CA">
        Geben Sie diesem Resolver eine eigene <code>storage</code>-Datei. Die Wiederverwendung der{' '}
        <code>acme.json</code> eines bestehenden Let&apos;s-Encrypt-Resolvers vermischt zwei
        ACME-Konten und lässt die Registrierung scheitern.
      </Callout>

      <h2>2. Ihn an einem Router verwenden</h2>
      <CodeBlock
        title="Labels des Dienstes"
        code={`labels:
  - traefik.enable=true
  - traefik.http.routers.nas.rule=Host(\`${EX.host}\`)
  - traefik.http.routers.nas.entrypoints=websecure
  - traefik.http.routers.nas.tls.certresolver=localcert`}
      />
      <p>
        Traefik fordert das Zertifikat beim ersten Start des Routers an und erneuert es danach
        selbstständig (standardmäßig 30 Tage vor Ablauf).
      </p>

      <h2>Wissenswertes</h2>
      <ul>
        <li>
          Der in <code>httpChallenge</code> angegebene Entrypoint muss existieren, erhält aber
          keine Validierungsanfrage: Er muss nicht außerhalb des LAN erreichbar sein.
        </li>
        <li>
          Die Ausstellung dauert ein bis drei Minuten. In dieser Zeit liefert Traefik sein
          Standardzertifikat aus; das ist normal.
        </li>
        <li>
          Für eine Wildcard deklarieren Sie die Namen am Router mit{' '}
          <code>tls.domains[0].main</code> / <code>sans</code>. Lehnt Traefik die Wildcard bei
          HTTP-01 ab, stellen Sie sie über die <Link href="/admin/api">API</Link> aus.
        </li>
        <li>
          Bei einem Fehler geben die Traefik-Logs auf Stufe <code>DEBUG</code> den von local-cert
          zurückgegebenen ACME-Fehler wieder – siehe die Fehlerbehebungstabelle unter{' '}
          <Link href="/admin/docs/acme">ACME-Server</Link>.
        </li>
      </ul>
    </>
  );
}

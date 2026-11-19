import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Coolify({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Coolify</h1>
      <p className="lead">
        Der Standard-Proxy von Coolify ist Traefik, per Argumente konfiguriert. Man fügt dort einen
        Resolver für local-cert hinzu und gibt ihn dann in den Labels der betroffenen Anwendungen
        an.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Den Resolver hinzufügen</h2>
      <p>
        <b>Servers</b> → Ihr Server → <b>Proxy</b> → <b>Configuration</b>. Fügen Sie im Abschnitt{' '}
        <code>command</code> des Traefik-Dienstes, im Anschluss an die Zeilen{' '}
        <code>--certificatesresolvers.letsencrypt…</code>, hinzu:
      </p>
      <CodeBlock
        title="Proxy-Konfiguration (Auszug)"
        code={`      - '--certificatesresolvers.localcert.acme.caserver=${ctx.directory}'
      - '--certificatesresolvers.localcert.acme.email=${EX.email}'
      - '--certificatesresolvers.localcert.acme.storage=/traefik/acme-localcert.json'
      - '--certificatesresolvers.localcert.acme.eab.kid=${EX.kid}'
      - '--certificatesresolvers.localcert.acme.eab.hmacencoded=${EX.hmac}'
      - '--certificatesresolvers.localcert.acme.httpchallenge.entrypoint=http'`}
      />
      <p>
        Speichern Sie und klicken Sie dann auf <b>Restart Proxy</b>. In Coolify heißen die
        Entrypoints <code>http</code> und <code>https</code>.
      </p>

      <h2>2. Ihn für eine Anwendung verwenden</h2>
      <ol>
        <li>
          Geben Sie der Anwendung die Domain <code>https://{EX.host}</code>.
        </li>
        <li>
          Deaktivieren Sie in ihren Einstellungen die Option, die die Container-Labels
          schreibgeschützt macht.
        </li>
        <li>
          Ersetzen Sie in den Labels am HTTPS-Router <code>certresolver=letsencrypt</code> durch{' '}
          <code>certresolver=localcert</code>.
        </li>
        <li>Deployen Sie erneut.</li>
      </ol>
      <CodeBlock
        title="Erwartetes Label"
        code={`traefik.http.routers.https-0-xxxxxxxx.tls.certresolver=localcert`}
      />

      <Callout title="Den ganzen Server auf local-cert umstellen">
        Hostet dieser Server nur interne Dienste, ist es einfacher, die Labels unverändert zu
        lassen und den Resolver <code>letsencrypt</code> selbst umzuleiten: Fügen Sie diesem
        Resolver die Zeilen <code>caserver</code>, <code>eab.kid</code> und{' '}
        <code>eab.hmacencoded</code> hinzu, löschen Sie seine vorhandene <code>acme.json</code> und
        starten Sie den Proxy neu.
      </Callout>

      <h2>Wissenswertes</h2>
      <ul>
        <li>
          Ist der Proxy des Servers Caddy, folgen Sie stattdessen der Anleitung{' '}
          <Link href="/admin/docs/acme/caddy">Caddy</Link>.
        </li>
        <li>
          Eine Neugenerierung der Labels durch Coolify setzt <code>letsencrypt</code> wieder ein:
          Deshalb muss der Schreibschutz bei diesen Anwendungen deaktiviert bleiben.
        </li>
      </ul>
    </>
  );
}

import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Dokploy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Dokploy</h1>
      <p className="lead">
        Dokploy leitet alles über Traefik. Man fügt ihm neben dem Let&apos;s-Encrypt-Resolver
        einen zweiten Zertifikats-Resolver hinzu und wählt ihn dann Domain für Domain aus.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Den Resolver hinzufügen</h2>
      <p>
        In Dokploy: <b>Web Server</b> → <b>Traefik</b> → die Hauptkonfiguration bearbeiten (Datei{' '}
        <code>/etc/dokploy/traefik/traefik.yml</code> auf dem Server). Behalten Sie unter{' '}
        <code>certificatesResolvers</code> den Eintrag <code>letsencrypt</code> bei und fügen Sie
        hinzu:
      </p>
      <CodeBlock
        title="traefik.yml (Auszug)"
        code={`certificatesResolvers:
  letsencrypt:
    # … unverändert …
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
        Speichern Sie und laden Sie Traefik dann auf derselben Seite neu (<b>Reload</b>). Die
        statische Konfiguration wird erst beim Neustart von Traefik erneut gelesen.
      </p>

      <h2>2. Ihn für eine Domain verwenden</h2>
      <ol>
        <li>
          In der Anwendung → <b>Domains</b> → fügen Sie <code>{EX.host}</code> hinzu.
        </li>
        <li>
          Aktivieren Sie <b>HTTPS</b>.
        </li>
        <li>
          Zertifikatsanbieter: <b>Custom</b>, Resolver <code>localcert</code>.
        </li>
      </ol>
      <Callout title="Keine Option „Custom“?">
        Bei Dokploy-Versionen, die nur <i>None</i> und <i>Let&apos;s Encrypt</i> anbieten, gibt es
        zwei Lösungen: Dokploy aktualisieren oder unter <b>Traefik</b> → dynamische Dateien den
        Router der Anwendung bearbeiten und dort <code>certResolver: letsencrypt</code> durch{' '}
        <code>certResolver: localcert</code> ersetzen.
      </Callout>

      <h2>3. Das DNS</h2>
      <p>
        <code>{EX.host}</code> muss auf die LAN-Adresse des Dokploy-Servers zeigen. local-cert
        kann diesen <code>A</code>-Eintrag für Sie veröffentlichen: siehe <b>DNS</b> in der{' '}
        <Link href="/admin/api">API</Link>.
      </p>

      <h2>Wissenswertes</h2>
      <ul>
        <li>
          Die öffentlichen Domains Ihrer anderen Anwendungen bleiben bei <code>letsencrypt</code>:
          Beide Resolver existieren nebeneinander.
        </li>
        <li>
          Behalten Sie pro Resolver eine eigene <code>storage</code>-Datei, wie oben.
        </li>
        <li>
          Das übrige Verhalten entspricht dem von Traefik: siehe{' '}
          <Link href="/admin/docs/acme/traefik">Traefik</Link>.
        </li>
      </ul>
    </>
  );
}

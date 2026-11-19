import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Dokploy({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Dokploy</h1>
      <p className="lead">
        Dokploy routes everything through Traefik. You add a second certificate resolver next to
        the Let&apos;s Encrypt one, then pick it domain by domain.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Add the resolver</h2>
      <p>
        In Dokploy: <b>Web Server</b> → <b>Traefik</b> → edit the main configuration (the{' '}
        <code>/etc/dokploy/traefik/traefik.yml</code> file on the server). Under{' '}
        <code>certificatesResolvers</code>, keep <code>letsencrypt</code> and add:
      </p>
      <CodeBlock
        title="traefik.yml (excerpt)"
        code={`certificatesResolvers:
  letsencrypt:
    # … unchanged …
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
        Save, then reload Traefik from the same page (<b>Reload</b>). The static configuration is
        only re-read when Traefik restarts.
      </p>

      <h2>2. Use it on a domain</h2>
      <ol>
        <li>
          In the application → <b>Domains</b> → add <code>{EX.host}</code>.
        </li>
        <li>
          Enable <b>HTTPS</b>.
        </li>
        <li>
          Certificate provider: <b>Custom</b>, resolver <code>localcert</code>.
        </li>
      </ol>
      <Callout title="No “Custom” option?">
        On Dokploy versions that only offer <i>None</i> and <i>Let&apos;s Encrypt</i>, there are two
        solutions: update Dokploy, or edit the application&apos;s router under <b>Traefik</b> →
        dynamic files, replacing <code>certResolver: letsencrypt</code> with{' '}
        <code>certResolver: localcert</code>.
      </Callout>

      <h2>3. DNS</h2>
      <p>
        <code>{EX.host}</code> must point to the Dokploy server&apos;s LAN address. local-cert can
        publish that <code>A</code> record for you: see <b>DNS</b> in the{' '}
        <Link href="/admin/api">API</Link>.
      </p>

      <h2>Good to know</h2>
      <ul>
        <li>
          The public domains of your other applications stay on <code>letsencrypt</code>: the two
          resolvers coexist.
        </li>
        <li>
          Keep a separate <code>storage</code> file per resolver, as above.
        </li>
        <li>
          Everything else behaves as in Traefik: see{' '}
          <Link href="/admin/docs/acme/traefik">Traefik</Link>.
        </li>
      </ul>
    </>
  );
}

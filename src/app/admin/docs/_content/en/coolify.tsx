import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout, EX, EabValues, type DocCtx } from '../../_lib/prose';

export default function Coolify({ ctx }: { ctx: DocCtx }) {
  return (
    <>
      <h1>Coolify</h1>
      <p className="lead">
        Coolify&apos;s default proxy is Traefik, configured through arguments. You add a resolver
        for local-cert, then reference it in the labels of the relevant applications.
      </p>
      <EabValues ctx={ctx} />

      <h2>1. Add the resolver</h2>
      <p>
        <b>Servers</b> → your server → <b>Proxy</b> → <b>Configuration</b>. In the{' '}
        <code>command</code> section of the Traefik service, after the{' '}
        <code>--certificatesresolvers.letsencrypt…</code> lines, add:
      </p>
      <CodeBlock
        title="proxy configuration (excerpt)"
        code={`      - '--certificatesresolvers.localcert.acme.caserver=${ctx.directory}'
      - '--certificatesresolvers.localcert.acme.email=${EX.email}'
      - '--certificatesresolvers.localcert.acme.storage=/traefik/acme-localcert.json'
      - '--certificatesresolvers.localcert.acme.eab.kid=${EX.kid}'
      - '--certificatesresolvers.localcert.acme.eab.hmacencoded=${EX.hmac}'
      - '--certificatesresolvers.localcert.acme.httpchallenge.entrypoint=http'`}
      />
      <p>
        Save, then <b>Restart Proxy</b>. In Coolify, the entrypoints are named <code>http</code>{' '}
        and <code>https</code>.
      </p>

      <h2>2. Use it on an application</h2>
      <ol>
        <li>
          Give the application the domain <code>https://{EX.host}</code>.
        </li>
        <li>
          In its settings, uncheck the option that makes the container labels read-only.
        </li>
        <li>
          In the labels, replace <code>certresolver=letsencrypt</code> with{' '}
          <code>certresolver=localcert</code> on the HTTPS router.
        </li>
        <li>Redeploy.</li>
      </ol>
      <CodeBlock
        title="expected label"
        code={`traefik.http.routers.https-0-xxxxxxxx.tls.certresolver=localcert`}
      />

      <Callout title="The whole server on local-cert">
        If this server only hosts internal services, it is simpler to leave the labels alone and
        redirect the <code>letsencrypt</code> resolver itself: add the <code>caserver</code>,{' '}
        <code>eab.kid</code> and <code>eab.hmacencoded</code> lines to that resolver, delete its
        existing <code>acme.json</code>, and restart the proxy.
      </Callout>

      <h2>Good to know</h2>
      <ul>
        <li>
          If the server&apos;s proxy is Caddy, follow the <Link href="/admin/docs/acme/caddy">Caddy</Link>{' '}
          guide instead.
        </li>
        <li>
          When Coolify regenerates the labels, <code>letsencrypt</code> comes back: that is why
          read-only labels must stay disabled on these applications.
        </li>
      </ul>
    </>
  );
}

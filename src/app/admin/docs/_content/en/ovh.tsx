import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout } from '../../_lib/prose';

const RIGHTS = `GET    /domain/zone
GET    /domain/zone/*
POST   /domain/zone/*
PUT    /domain/zone/*
DELETE /domain/zone/*`;

export default function Ovh() {
  return (
    <>
      <h1>OVHcloud provider</h1>
      <p className="lead">
        local-cert manages OVHcloud DNS zones through the OVH API, using a set of three keys
        limited to DNS.
      </p>

      <h2>1. Create the token</h2>
      <p>
        OVH offers a page that creates all three keys at once. Open the one for your region while
        logged in to your account:
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Creation page</th>
              <th>Value of &quot;API region&quot;</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Europe</td>
              <td>
                <code>https://eu.api.ovh.com/createToken/</code>
              </td>
              <td>
                <code>ovh-eu</code>
              </td>
            </tr>
            <tr>
              <td>Canada</td>
              <td>
                <code>https://ca.api.ovh.com/createToken/</code>
              </td>
              <td>
                <code>ovh-ca</code>
              </td>
            </tr>
            <tr>
              <td>United States</td>
              <td>
                <code>https://api.us.ovhcloud.com/createToken/</code>
              </td>
              <td>
                <code>ovh-us</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ol>
        <li>
          <b>Application name</b>: <code>local-cert</code>. Free-form description.
        </li>
        <li>
          <b>Validity</b>: <b>Unlimited</b>. A token with a limited lifetime would stop working
          without warning, renewals included.
        </li>
        <li>
          <b>Rights</b>: add these five lines (the link offered by local-cert&apos;s wizard
          pre-fills them):
        </li>
      </ol>
      <CodeBlock title="Rights to grant" code={RIGHTS} />
      <ol start={4}>
        <li>
          <b>Create keys</b>. The page shows the <b>Application Key</b>, the{' '}
          <b>Application Secret</b> and the <b>Consumer Key</b>: note all three.
        </li>
      </ol>
      <Callout title="Limiting to a single zone">
        To give access to one domain only, replace <code>*</code> with its name in the rights:{' '}
        <code>/domain/zone/example.com</code> and <code>/domain/zone/example.com/*</code>. Keep{' '}
        <code>GET /domain/zone</code>, which is used to list zones.
      </Callout>

      <h2>2. Create the provider</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Providers</Link> → <b>+ New provider</b> →{' '}
          <b>OVHcloud</b>.
        </li>
        <li>Choose the region, give it a name, paste the three keys.</li>
        <li>
          <b>Test connection</b>: local-cert lists your zones. Then <b>Save</b>.
        </li>
      </ol>

      <h2>3. Add a domain</h2>
      <p>
        <Link href="/admin/domains">Domains</Link> → <b>+ Add a domain</b> → this provider → the
        zone. The test creates and then deletes a temporary TXT record. No extra setting is needed
        on the OVH side: the permissions are those of the token.
      </p>

      <h2>Good to know</h2>
      <ul>
        <li>
          The domain must use <b>OVH&apos;s DNS servers</b> (active DNS zone in the customer
          area). If its name servers point elsewhere, that other host is the one to declare.
        </li>
        <li>
          OVH only applies a change after a zone &quot;refresh&quot;; local-cert triggers one after
          every write. Propagation to the secondary servers can take one to two minutes: that is the
          normal duration of an issuance.
        </li>
        <li>Minimum TTL: 60 seconds.</li>
      </ul>

      <h2>Troubleshooting</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Message</th>
              <th>Cause</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>Invalid signature</code>
              </td>
              <td>Application Secret or Consumer Key mistyped, or wrong region.</td>
            </tr>
            <tr>
              <td>
                <code>This credential is not valid</code>
              </td>
              <td>Consumer Key expired or revoked: create a new token with unlimited validity.</td>
            </tr>
            <tr>
              <td>
                <code>This call has not been granted</code>
              </td>
              <td>A line is missing from the token&apos;s rights.</td>
            </tr>
            <tr>
              <td>
                <code>This application key is invalid</code>
              </td>
              <td>Application Key from another region.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

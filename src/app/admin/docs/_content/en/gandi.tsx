import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function Gandi() {
  return (
    <>
      <h1>Gandi provider</h1>
      <p className="lead">
        local-cert manages Gandi LiveDNS with a Personal Access Token, which you limit to the
        domains and permissions that are strictly necessary.
      </p>

      <h2>1. Create the token</h2>
      <ol>
        <li>
          In Gandi: <b>Organizations</b> → the organization that owns the domains → <b>Sharing</b>{' '}
          → <b>Personal Access Tokens</b> → <b>Create a token</b>. Direct link:{' '}
          <code>https://admin.gandi.net/organizations/account/pat</code>.
        </li>
        <li>
          <b>Name</b>: <code>local-cert</code>. <b>Expiration</b>: the longest you are comfortable
          with — when it expires, issuance and renewals stop.
        </li>
        <li>
          <b>Resources</b>: restrict to the domains local-cert must manage.
        </li>
        <li>
          <b>Permissions</b>: check <b>Manage domain technical configurations</b>. The related read
          permissions get checked automatically.
        </li>
        <li>
          <b>Create</b>, then copy the token: it is displayed only once.
        </li>
      </ol>
      <Callout kind="warn" title="Not the old API key">
        Gandi&apos;s older &quot;API keys&quot; (<code>Apikey</code> header) are deprecated and not
        supported: you need a Personal Access Token.
      </Callout>

      <h2>2. Create the provider</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Providers</Link> → <b>+ New provider</b> → <b>Gandi</b>.
        </li>
        <li>Give it a name and paste the token.</li>
        <li>
          <b>Test connection</b>, then <b>Save</b>.
        </li>
      </ol>

      <h2>3. Add a domain</h2>
      <p>
        <Link href="/admin/domains">Domains</Link> → <b>+ Add a domain</b> → this provider → the
        domain. The test creates and then deletes a temporary TXT record.
      </p>

      <h2>Good to know</h2>
      <ul>
        <li>
          The domain must use <b>LiveDNS</b> (<code>ns-*.gandi.net</code> servers). A domain
          registered at Gandi but served by external name servers doesn&apos;t appear in the list.
        </li>
        <li>
          <b>Minimum TTL: 300 seconds.</b> local-cert raises any lower value. This has no effect on
          certificate issuance.
        </li>
        <li>
          To switch tokens as one nears expiry: <Link href="/admin/providers">Providers</Link> →{' '}
          <b>Edit</b>, paste the new one, <b>Test</b>, <b>Save</b>.
        </li>
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
                <code>401</code>
              </td>
              <td>Token mistyped, expired or deleted.</td>
            </tr>
            <tr>
              <td>
                <code>403</code>
              </td>
              <td>
                The token lacks the technical configuration permission, or the domain is not among
                its resources.
              </td>
            </tr>
            <tr>
              <td>The zone list is empty</td>
              <td>None of the domains in the token&apos;s scope uses LiveDNS.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

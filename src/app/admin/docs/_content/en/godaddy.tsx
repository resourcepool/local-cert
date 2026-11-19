import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function GoDaddy() {
  return (
    <>
      <h1>GoDaddy provider</h1>
      <p className="lead">
        local-cert manages GoDaddy DNS with a production API key. First check that your account is
        eligible: GoDaddy doesn&apos;t open the API to everyone.
      </p>

      <Callout kind="warn" title="API access requirement">
        GoDaddy reserves its domain and DNS management APIs for accounts that hold at least ten
        domains, or a Discount Domain Club subscription. Below that, the key is created normally
        but every call answers <code>403 ACCESS_DENIED</code>. If that is your case, the lasting
        fix is to delegate the relevant subdomain to a supported DNS host — see the bottom of this
        page.
      </Callout>

      <h2>1. Create the key</h2>
      <ol>
        <li>
          Open <code>https://developer.godaddy.com/keys</code>, logged in to the account that holds
          the domains.
        </li>
        <li>
          <b>Create New API Key</b>. Name: <code>local-cert</code>. Environment:{' '}
          <b>Production</b> (an <i>OTE</i> key doesn&apos;t see your real domains).
        </li>
        <li>
          Copy the <b>Key</b> and the <b>Secret</b>: the secret is displayed only once.
        </li>
      </ol>
      <p>
        A GoDaddy key gives access to the whole account: there is no restriction by domain or by
        type of operation.
      </p>

      <h2>2. Create the provider</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Providers</Link> → <b>+ New provider</b> → <b>GoDaddy</b>.
        </li>
        <li>Give it a name, paste the key and the secret.</li>
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
          The domain must use GoDaddy&apos;s name servers (<code>ns*.domaincontrol.com</code>).
        </li>
        <li>
          <b>Minimum TTL: 600 seconds.</b> local-cert raises any lower value. This has no effect on
          certificate issuance.
        </li>
      </ul>

      <h2>If your account has no API access</h2>
      <p>
        Keep the domain at GoDaddy and delegate only your local network&apos;s subdomain to a host
        that local-cert can manage:
      </p>
      <ol>
        <li>
          Create a <code>home.example.com</code> zone at AWS Route53, OVHcloud, Gandi or Google
          Cloud DNS.
        </li>
        <li>
          In GoDaddy&apos;s DNS for <code>example.com</code>, add one <code>NS</code> record per
          name server of that zone, with the name <code>home</code>.
        </li>
        <li>Declare the matching provider and add the delegated domain.</li>
      </ol>

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
                <code>401 UNABLE_TO_AUTHENTICATE</code>
              </td>
              <td>Wrong key or secret, or an OTE key used in production.</td>
            </tr>
            <tr>
              <td>
                <code>403 ACCESS_DENIED</code>
              </td>
              <td>The account doesn&apos;t meet the API access requirement.</td>
            </tr>
            <tr>
              <td>
                <code>422</code> on write
              </td>
              <td>Value rejected by GoDaddy (TTL, format): the message names the field.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

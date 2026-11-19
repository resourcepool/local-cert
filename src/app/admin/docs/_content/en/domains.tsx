import Link from 'next/link';
import { Callout } from '../../_lib/prose';

export default function Domains() {
  return (
    <>
      <h1>Add a domain</h1>
      <p className="lead">
        A managed domain is a base name — <code>home.example.com</code> — under which local-cert is
        allowed to issue. It relies on a hosted zone of a provider. The wizard on the{' '}
        <Link href="/admin/domains">Domains</Link> page does everything in three screens.
      </p>

      <h2>Before you start</h2>
      <ul>
        <li>
          A registered <Link href="/admin/docs/providers">provider</Link> whose test is green.
        </li>
        <li>
          A <b>public</b> zone at that host, authoritative for the name. Let&apos;s Encrypt must be
          able to read the validation record from the Internet: a private zone won&apos;t do, even
          if your hosts themselves stay private.
        </li>
      </ul>
      <Callout title="Dedicate a zone to the LAN">
        You don&apos;t have to open up your main zone. Create a Route53 zone for{' '}
        <code>home.example.com</code> and delegate it from <code>example.com</code> with four{' '}
        <code>NS</code> records: local-cert will only have permissions on that subdomain, whoever
        hosts the parent zone.
      </Callout>

      <h2>1. Choose the provider</h2>
      <p>
        <b>+ Add a domain</b>, then select the provider. local-cert queries the account and shows
        the number of visible zones.
      </p>

      <h2>2. Choose the zone</h2>
      <p>
        The account&apos;s zones are listed with their identifier. A private zone is greyed out. If
        a zone already carries a managed domain, it is indicated.
      </p>
      <ul>
        <li>
          <b>Base name</b>: the zone name by default. You can narrow it to a subdomain (
          <code>lab.home.example.com</code> in the <code>home.example.com</code> zone): only names
          below it can receive a certificate.
        </li>
        <li>
          <b>Default TTL</b>: lifetime of the records local-cert publishes. 60 seconds is fine.
        </li>
      </ul>

      <h2>3. Grant permissions, test, add</h2>
      <p>
        local-cert immediately tests its permissions on the zone. If they are already in place,
        you only need to confirm. Otherwise the screen shows what to do:
      </p>
      <ol>
        <li>
          In the AWS console, open the role (or user) shown → <b>Permissions</b> tab.
        </li>
        <li>
          Click the <b>existing</b> policy, <code>local-cert-route53</code> — the one created with
          the provider — then <b>Edit</b> → <b>JSON</b> tab. Don&apos;t add a second policy: this is
          the one that gets extended.
        </li>
        <li>
          Replace the whole content with the document shown, then <b>Next</b> →{' '}
          <b>Save changes</b>. It contains the zones already declared on this provider{' '}
          <b>plus</b> the new one: nothing is removed.
        </li>
        <li>
          Go back to the wizard and click <b>Retest</b>.
        </li>
        <li>
          When all the required lines show <code>OK</code>, click <b>Add the domain</b>.
        </li>
      </ol>

      <h3>Add without waiting: the pending status</h3>
      <p>
        A host can take a few minutes to apply a permission change. Rather than retesting by hand,
        add the domain while the test is still failing (<b>Add as pending</b> button):
      </p>
      <ul>
        <li>
          the domain is <b>pending</b>: local-cert reruns the test every minute, five times, and
          sets it to <b>active</b> as soon as it succeeds;
        </li>
        <li>
          after five failures it goes to <b>error</b>, with the last refusal displayed. Fix the
          permissions, then click <b>Retry check</b>: a new cycle starts;
        </li>
        <li>
          until it is active, the domain receives no certificate and no record: the API answers{' '}
          <code>409</code> and the ACME server answers <code>rejectedIdentifier</code>.
        </li>
      </ul>

      <Callout title="Outside AWS, this step is shorter">
        With OVHcloud, Gandi, GoDaddy and Google Cloud, permissions are carried by the
        provider&apos;s credentials: there is no policy to paste, only the test. It creates and
        then deletes a temporary TXT record in the zone. The steps above and the table below
        describe the AWS case.
      </Callout>

      <h3>What the test checks</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Call</th>
              <th>Required</th>
              <th>Used for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ListResourceRecordSets</code>
              </td>
              <td>yes</td>
              <td>reading the zone, and checking that it covers the base name</td>
            </tr>
            <tr>
              <td>
                <code>GetHostedZone</code>
              </td>
              <td>yes</td>
              <td>finding the name servers to query during validation</td>
            </tr>
            <tr>
              <td>
                <code>GetChange</code>
              </td>
              <td>yes</td>
              <td>waiting for a write to propagate</td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code> (TXT)
              </td>
              <td>yes</td>
              <td>writing the validation record</td>
            </tr>
            <tr>
              <td>
                <code>ChangeResourceRecordSets</code> (A)
              </td>
              <td>no</td>
              <td>publishing a host&apos;s address, if you ask for it at issuance</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Write permission is probed by deleting a record that doesn&apos;t exist: AWS checks the
        authorization before noticing there is nothing to delete.{' '}
        <b>The test never modifies the zone.</b>
      </p>

      <h3>If the test stays red</h3>
      <ul>
        <li>Wait a few seconds and retest: IAM doesn&apos;t propagate instantly.</li>
        <li>
          Check that the policy was pasted on the identity shown, and not on the user when the
          provider goes through a role.
        </li>
        <li>
          If every line fails with the same message, the problem is the provider itself: use the{' '}
          <b>Test</b> button in <Link href="/admin/providers">Providers</Link>.
        </li>
        <li>
          If a <code>CAA</code> record exists on the zone, it must allow{' '}
          <code>letsencrypt.org</code> — the test doesn&apos;t check it, but issuance will fail.
        </li>
      </ul>
      <p>
        <b>Add anyway</b> saves a domain whose test fails. Useful for preparing a configuration; no
        issuance will succeed while permissions are missing.
      </p>

      <h2>Next</h2>
      <ul>
        <li>
          Give access to the domain in <Link href="/admin/keys">Keys &amp; access</Link>: an API
          key with its permissions, or an EAB credential for an ACME client.
        </li>
        <li>
          Issue a first certificate: <Link href="/admin/docs">Quick start</Link>.
        </li>
      </ul>

      <h2>Remove a domain</h2>
      <p>
        <b>Remove</b> is refused as long as certificates exist. <b>Force</b> revokes them, cleans
        the zone as far as possible, then deletes everything. Afterwards, remember to regenerate the
        provider&apos;s policy (<b>policy</b> button) and paste it into AWS again: the removed zone
        no longer appears in it.
      </p>
    </>
  );
}

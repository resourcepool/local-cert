import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { Callout } from '../../_lib/prose';

export default function Gcp() {
  return (
    <>
      <h1>Google Cloud provider</h1>
      <p className="lead">
        local-cert manages Cloud DNS as a service account, using its JSON key. One provider
        corresponds to one Google Cloud project.
      </p>

      <h2>Before you start</h2>
      <ul>
        <li>
          The <b>Cloud DNS</b> API is enabled on the project (<b>APIs &amp; Services</b> →{' '}
          <b>Library</b> → Cloud DNS API).
        </li>
        <li>
          The zone is <b>public</b>. A private zone is invisible to Let&apos;s Encrypt.
        </li>
      </ul>

      <h2>1. Create the service account</h2>
      <ol>
        <li>
          Google Cloud console, the project that holds your zones → <b>IAM &amp; Admin</b> →{' '}
          <b>Service Accounts</b> → <b>Create service account</b>.
        </li>
        <li>
          <b>Name</b>: <code>local-cert-dns</code>. <b>Create and continue</b>.
        </li>
        <li>
          <b>Role</b>: <b>DNS Administrator</b> (<code>roles/dns.admin</code>).{' '}
          <b>Continue</b>, then <b>Done</b>.
        </li>
      </ol>
      <p>Or from the command line:</p>
      <CodeBlock
        title="gcloud"
        code={`PROJECT=my-project
gcloud iam service-accounts create local-cert-dns --project "$PROJECT"
gcloud projects add-iam-policy-binding "$PROJECT" \\
  --member "serviceAccount:local-cert-dns@$PROJECT.iam.gserviceaccount.com" \\
  --role roles/dns.admin`}
      />

      <h2>2. Create the JSON key</h2>
      <ol>
        <li>
          Open the service account → <b>Keys</b> tab → <b>Add key</b> → <b>Create new key</b> →{' '}
          <b>JSON</b>.
        </li>
        <li>A <code>.json</code> file is downloaded: it is the only copy.</li>
      </ol>
      <CodeBlock
        title="gcloud"
        code={`gcloud iam service-accounts keys create local-cert-dns.json \\
  --iam-account "local-cert-dns@$PROJECT.iam.gserviceaccount.com"`}
      />
      <Callout title="Key creation blocked?">
        Some organizations forbid service account keys (the{' '}
        <code>iam.disableServiceAccountKeyCreation</code> constraint). An organization
        administrator then has to lift it for this project.
      </Callout>

      <h2>3. Create the provider</h2>
      <ol>
        <li>
          <Link href="/admin/providers">Providers</Link> → <b>+ New provider</b> →{' '}
          <b>Google Cloud</b>.
        </li>
        <li>
          Give it a name and paste the <b>entire content</b> of the JSON file. The project ID is
          read from the key; only fill it in if the zones are in a different project.
        </li>
        <li>
          <b>Test connection</b>, then <b>Save</b>. Then delete the downloaded file.
        </li>
      </ol>

      <h2>4. Add a domain</h2>
      <p>
        <Link href="/admin/domains">Domains</Link> → <b>+ Add a domain</b> → this provider → the
        zone. The test creates and then deletes a temporary TXT record.
      </p>

      <h2>Good to know</h2>
      <ul>
        <li>
          The <code>roles/dns.admin</code> role applies to every zone in the project. To isolate a
          zone, put it in a dedicated project, or grant the role at the zone level rather than the
          project level (the managed zone&apos;s IAM) while keeping <code>roles/dns.reader</code>{' '}
          for the account on the project, for listing.
        </li>
        <li>
          The domain must be delegated to the name servers Cloud DNS gives for the zone (
          <code>ns-cloud-*.googledomains.com</code>).
        </li>
        <li>
          Several projects: one provider per project, each with its own service account — or a
          single service account that each project grants the role to, declared as many
          providers with different <b>project IDs</b>.
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
                <code>invalid_grant</code>
              </td>
              <td>Key deleted or service account disabled; server clock out of sync.</td>
            </tr>
            <tr>
              <td>
                <code>403 … Cloud DNS API has not been used</code>
              </td>
              <td>The Cloud DNS API isn&apos;t enabled on the project.</td>
            </tr>
            <tr>
              <td>
                <code>403 Forbidden</code>
              </td>
              <td>The service account doesn&apos;t have the DNS role on this project.</td>
            </tr>
            <tr>
              <td>
                <code>The service account key is not valid JSON</code>
              </td>
              <td>The file was only partially pasted.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

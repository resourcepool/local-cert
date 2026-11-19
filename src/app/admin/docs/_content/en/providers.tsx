import Link from 'next/link';
import { CodeBlock } from '@/components/ui';
import { getMessages } from '@/lib/i18n/server';
import { localizeProvider } from '@/lib/i18n/provider-text';
import { PROVIDER_INFO, PROVIDER_TYPES } from '@/lib/dns/provider-types';
import { Callout } from '../../_lib/prose';

export default async function Providers() {
  const messages = await getMessages();
  return (
    <>
      <h1>DNS providers</h1>
      <p className="lead">
        A provider is an account at the host of your DNS zones, with the credentials that let
        local-cert write there. This is how the proof Let&apos;s Encrypt asks for gets published: a
        TXT record set for the duration of the validation.
      </p>

      <h2>Supported hosts</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Host</th>
              <th>Service</th>
              <th>Credentials</th>
              <th>Minimum TTL</th>
              <th>Guide</th>
            </tr>
          </thead>
          <tbody>
            {PROVIDER_TYPES.map((type) => {
              const info = localizeProvider(messages, PROVIDER_INFO[type]);
              return (
                <tr key={type}>
                  <td>{info.label}</td>
                  <td>{info.product}</td>
                  <td>
                    {type === 'aws'
                      ? 'IAM key, role recommended'
                      : info.fields
                          .filter((f) => f.required)
                          .map((f) => f.label)
                          .join(', ')}
                  </td>
                  <td>{info.minTtl} s</td>
                  <td>
                    <Link href={`/admin/docs/${info.docs}`}>open</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>The principle, whichever host you use</h2>
      <ol>
        <li>
          At the host, you create credentials <b>limited to DNS</b> — never those of your main
          account.
        </li>
        <li>
          <Link href="/admin/providers">Providers</Link> → <b>+ New provider</b>: you pick the
          host, paste the credentials, test, save.
        </li>
        <li>
          <Link href="/admin/domains">Domains</Link> → <b>+ Add a domain</b>: local-cert lists the
          account&apos;s zones, you pick one, and it tests its permissions.
        </li>
      </ol>
      <p>
        Several providers on the same host is the normal case: one per account, or one per
        permission scope. Secrets are encrypted in the database (AES-256-GCM with{' '}
        <code>MASTER_KEY</code>) and are never displayed again or returned by the API.
      </p>

      <h2>What differs from one host to another</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>AWS Route53</th>
              <th>The others</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Permissions</td>
              <td>per zone: an IAM policy to extend with every domain added</td>
              <td>carried by the credentials: nothing to change when you add a domain</td>
            </tr>
            <tr>
              <td>Permission test</td>
              <td>no write at all in the zone</td>
              <td>
                a temporary TXT record (<code>_localcert-preflight-…</code>) is created and then
                deleted
              </td>
            </tr>
            <tr>
              <td>Writes</td>
              <td>atomic, tracked until propagation</td>
              <td>record by record</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout title="Minimum TTL">
        Gandi (300 s) and GoDaddy (600 s) refuse short TTLs. local-cert then silently raises the
        requested value. This doesn&apos;t prevent issuance — validation reads the authoritative
        servers directly — but a modified <code>A</code> record will take that long to be seen
        everywhere.
      </Callout>

      <h2>Marking what local-cert creates</h2>
      <p>
        Every record published at your request comes with a TXT{' '}
        <code>_local-cert.&lt;name&gt;</code>: this is what lets you tell, in the zone, what comes
        from local-cert from what was already there. Setting <code>TAG_RECORDS=0</code> turns it
        off.
      </p>

      <h2>Declaring a provider with environment variables</h2>
      <p>
        When credentials must come from the deployment rather than the database, a provider can be
        declared with variables. This is optional, and the block is repeated with a different label
        for each account.
      </p>
      <CodeBlock
        title=".env"
        code={`# PROVIDER_<HOST>_<LABEL>_NAME declares the provider; the rest are its credentials
PROVIDER_AWS_DEFAULT_NAME="Default AWS"
PROVIDER_AWS_DEFAULT_ACCESS_KEY_ID=AKIA…
PROVIDER_AWS_DEFAULT_SECRET_ACCESS_KEY=…
PROVIDER_AWS_DEFAULT_ROLE_ARN=arn:aws:iam::123456789012:role/local-cert-dns

PROVIDER_OVH_PERSO_NAME="ovh-perso"
PROVIDER_OVH_PERSO_ENDPOINT=ovh-eu
PROVIDER_OVH_PERSO_APPLICATION_KEY=…
PROVIDER_OVH_PERSO_APPLICATION_SECRET=…
PROVIDER_OVH_PERSO_CONSUMER_KEY=…

PROVIDER_GANDI_MAIN_NAME="gandi"
PROVIDER_GANDI_MAIN_TOKEN=…

PROVIDER_GODADDY_MAIN_NAME="godaddy"
PROVIDER_GODADDY_MAIN_API_KEY=…
PROVIDER_GODADDY_MAIN_API_SECRET=…

PROVIDER_GCP_MAIN_NAME="gcp"
PROVIDER_GCP_MAIN_SERVICE_ACCOUNT_JSON=<the key's JSON, or its base64 encoding>
PROVIDER_GCP_MAIN_PROJECT_ID=my-project   # optional`}
      />
      <ul>
        <li>
          The label (<code>DEFAULT</code>, <code>PERSO</code>, <code>MAIN</code>…) is free:
          uppercase letters, digits and underscores.
        </li>
        <li>
          These providers appear in the console with an <i>environment</i> tag. They can be tested,
          but not edited or removed: that is done in the variables, followed by a restart. Their
          secrets are never written to the database.
        </li>
        <li>
          An incomplete declaration is ignored, with a message at startup naming the missing
          variable.
        </li>
      </ul>
    </>
  );
}

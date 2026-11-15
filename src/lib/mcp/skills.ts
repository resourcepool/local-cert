import { z } from 'zod';
import { METADATA_LIMITS } from '@/lib/validation';
import {
  FEATURE_TOOLS,
  ToolError,
  inputSchemaOf,
  isAdminPrincipal,
  tool,
  type SkillGroup,
  type ToolDef,
} from './tools';
import type { Principal } from '@/lib/auth/guard';

/**
 * Skills: short manuals that tell an agent how to use the tools.
 *
 * Each one is a SKILL.md-style Markdown document (YAML front matter, then the
 * body). The prose explains the workflow; the tool reference under it is
 * rendered from the tool catalogue itself, so it cannot drift from what the
 * server actually exposes.
 *
 * They are served two ways: the `list_skills` / `get_skill` tools, which every
 * MCP client can call, and MCP resources at skill://local-cert/<name>.
 */

export interface Skill {
  name: string;
  description: string;
  /** admin skills are only listed for, and served to, admin keys */
  admin: boolean;
  groups: SkillGroup[];
  intro: string;
}

export const SKILL_URI_PREFIX = 'skill://local-cert/';

const SKILLS: Skill[] = [
  {
    name: 'local-cert-getting-started',
    description:
      'Start here. What local-cert is, how its API-key permissions work, how errors are ' +
      'reported, and which skill covers which tools.',
    admin: false,
    groups: ['general'],
    intro: `
local-cert issues Let's Encrypt certificates for hosts on a private network. It
proves domain ownership with a DNS-01 challenge in AWS Route53, so the hosts never
need to be reachable from the internet. An administrator registers **managed
domains** (a base name such as \`home.example.com\` plus its Route53 zone);
certificates and DNS records are then created for names under them.

## Permissions

This MCP server authenticates with the same API key as the REST API, and every
tool enforces the same rules as the REST endpoint it corresponds to.

- A key holds **scopes per managed domain**: \`cert:read\`, \`cert:issue\`,
  \`cert:renew\`, \`cert:revoke\`, \`cert:export\` (download private keys),
  \`dns:read\`, \`dns:write\`.
- An **admin key** holds every scope on every domain and additionally sees the
  \`admin_*\` tools. Non-admin keys do not see those tools at all.
- Call \`whoami\` first. It lists the domains you can see and your scopes on each,
  which tells you in advance which tools will be refused.

## Errors

A failed tool call returns \`isError: true\` with a JSON body
\`{ "error", "message", "detail" }\`. \`error\` is one of:

- \`forbidden\` — the key lacks the scope named in the message. Do not retry; tell
  the user which scope is missing.
- \`not_found\` — no such certificate, domain or key.
- \`validation_error\` — bad arguments; \`detail\` lists the offending fields. Also
  returned when a name is not under any managed domain.
- \`conflict\` — the resource is in a state that forbids the action (already
  running, revoked, still referenced). The message says which.
- \`upstream_error\` — Route53 or the certificate authority failed. Often
  transient; retrying once is reasonable.
- \`internal_error\` — unexpected; report it rather than retrying.

## Where to go next

- \`local-cert-certificates\` — request, track, export, renew and revoke certificates.
- \`local-cert-dns\` — check whether a subdomain is free, and manage DNS records.
- \`local-cert-admin\` — managed domains, API keys and instance statistics
  (admin keys only).
`,
  },
  {
    name: 'local-cert-certificates',
    description:
      'Request, track, export, renew, annotate and revoke Let\'s Encrypt certificates. ' +
      'Read before calling any certificate tool.',
    admin: false,
    groups: ['certificates'],
    intro: `
## Issuing a certificate

1. \`whoami\` — confirm the name falls under a managed domain on which you hold
   \`cert:issue\`.
2. \`check_subdomain\` (see \`local-cert-dns\`) — optional, but it avoids issuing for
   a name another host already uses.
3. \`request_certificate\` — returns at once with status \`pending\`. All names of
   one request must belong to the same managed domain. A wildcard is written
   \`*.home.example.com\` and does not cover the bare \`home.example.com\`; list both
   if both are needed.
4. Poll \`get_certificate\` every 15 seconds or so. Statuses move
   \`pending\` → \`dns_propagating\` → \`validating\` → \`issued\`. Issuance usually
   takes one to three minutes, mostly waiting for DNS.
5. If the status becomes \`failed\`, read \`get_certificate_events\` for the reason,
   fix it, then call \`renew_certificate\` to retry the same order.
6. \`get_certificate_bundle\` — fetch the PEMs once the status is \`issued\`.

Pass an \`idempotency_key\` to \`request_certificate\` whenever a retry is possible:
repeating the call with the same key returns the original order instead of
creating a duplicate.

## Private keys

\`get_certificate_bundle\` returns only the public chain unless \`include\` contains
\`"key"\`. The private key then appears in the conversation. Request it only when
the user asked for it, needs \`cert:export\`, and never copy it into files, logs or
other tools unless the user directed that.

## Renewal

Certificates with \`auto_renew\` (the default) renew themselves
\`renew_before_days\` days before expiry. \`renew_certificate\` is only for forcing
it early or retrying a failure.

## Metadata

Every certificate carries a free-form string map for business context (tenant,
environment, ticket). Limits: ${METADATA_LIMITS.maxKeys} entries, keys up to
${METADATA_LIMITS.maxKeyLength} characters from letters, digits and \`. _ : -\`,
values up to ${METADATA_LIMITS.maxValueLength} characters. Set it at request time
or later with \`update_certificate_metadata\`; filter on it with the \`metadata\`
argument of \`list_certificates\`.

## Revoking

\`revoke_certificate\` is irreversible: the certificate is revoked at the CA and its
private key destroyed. Confirm with the user before calling it.
`,
  },
  {
    name: 'local-cert-dns',
    description:
      'Check whether a subdomain is already in use, and read, create, replace or delete ' +
      'Route53 records under a managed domain.',
    admin: false,
    groups: ['dns'],
    intro: `
DNS tools act directly on the Route53 hosted zone of the managed domain that
covers the name. Changes are live on the real zone within seconds.

## Is a name free?

\`check_subdomain\` answers from two sources that can disagree: the zone (a record
may exist that local-cert never created) and local-cert (a certificate may exist
with no record published). Trust \`available: true\` only; when \`dns.error\` is set
the zone could not be read and the answer is unknown, not free.

## Records

- \`upsert_dns_record\` **replaces** the full value set of a record with the same
  name and type. To add a value, read the record first and send the old values
  plus the new one.
- \`delete_dns_record\` needs the exact type, values and TTL of the existing record.
  Read them with \`list_dns_records\` first.
- \`_acme-challenge.*\` records belong to the issuance worker and are refused.
- To point a new host at a LAN address, prefer \`dns.create_record\` on
  \`request_certificate\`: that record is then cleaned up when the certificate is
  revoked. Records made with \`upsert_dns_record\` are yours to remove.

Confirm with the user before replacing or deleting a record you did not create.
`,
  },
  {
    name: 'local-cert-admin',
    description:
      'Administer the instance: register and remove managed domains, mint, scope, revoke and ' +
      'delete API keys, read instance statistics and the audit trail. Admin keys only.',
    admin: true,
    groups: ['admin'],
    intro: `
These tools require an admin key. They are the same operations as the admin
console. Every change is written to the audit log with the calling key as actor;
\`admin_get_stats\` returns the most recent entries.

## Onboarding a domain

1. \`admin_create_domain\` with the base name and its Route53 hosted zone id. It
   verifies the zone serves the name and that the instance's AWS credentials can
   read and write it. On a permission failure the error \`detail.checks\` shows
   which Route53 action is missing — fix the IAM policy rather than using
   \`force\`, which registers a domain that cannot issue.
2. \`admin_create_api_key\` with a grant on the new domain for whoever will use it.

## API keys

- Grant the fewest scopes that do the job. \`cert:export\` exposes private keys and
  \`dns:write\` can change any record in the zone; give them deliberately.
- \`is_admin: true\` creates a key with full control of the instance, including
  minting further admin keys. Do it only on an explicit request from the user.
- The plaintext token is returned once by \`admin_create_api_key\`. Give it to the
  user straight away; it cannot be recovered, only replaced.
- \`admin_update_api_key\` with \`grants\` replaces the whole grant set. Call
  \`admin_list_api_keys\` first and resend the grants that must be kept.
- To cut off access, revoke (\`revoked: true\`) rather than delete: it is
  reversible and keeps the audit trail readable.

## Removing a domain

\`admin_delete_domain\` refuses while any certificate row remains. \`force: true\`
revokes and deletes all of them first. That destroys every certificate and
private key under the domain and cannot be undone — confirm with the user, naming
the domain and the certificate count from \`admin_list_domains\`.
`,
  },
];

type JsonSchema = {
  type?: string;
  enum?: unknown[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  default?: unknown;
  description?: string;
  additionalProperties?: JsonSchema | boolean;
};

function typeOf(s: JsonSchema): string {
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' | ');
  if (s.anyOf) return [...new Set(s.anyOf.map(typeOf))].join(' | ');
  if (s.type === 'array') return `array of ${typeOf(s.items ?? {})}`;
  if (s.type === 'object' && !s.properties && typeof s.additionalProperties === 'object') {
    return `map of string to ${typeOf(s.additionalProperties)}`;
  }
  return s.type ?? 'any';
}

function renderProps(schema: JsonSchema, indent = ''): string[] {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).flatMap(([name, s]) => {
    const facts = [
      typeOf(s),
      required.has(name) ? 'required' : 'optional',
      ...('default' in s ? [`default ${JSON.stringify(s.default)}`] : []),
    ];
    const line = `${indent}- \`${name}\` (${facts.join(', ')})${s.description ? ` — ${s.description}` : ''}`;
    const nested = s.properties ? s : s.items?.properties ? s.items : null;
    return [line, ...(nested ? renderProps(nested, `${indent}  `) : [])];
  });
}

function renderTool(t: ToolDef): string {
  const params = renderProps(inputSchemaOf(t) as JsonSchema);
  return [
    `### \`${t.name}\` — ${t.title}`,
    '',
    t.description,
    '',
    `- **Requires:** ${t.requires}`,
    `- **Effect:** ${
      t.annotations.readOnlyHint
        ? 'read-only'
        : t.annotations.destructiveHint
          ? 'modifies or deletes existing state'
          : 'creates new state'
    }`,
    '',
    params.length ? `**Arguments**\n\n${params.join('\n')}` : '**Arguments:** none',
  ].join('\n');
}

export function visibleSkills(p: Principal): Skill[] {
  const admin = isAdminPrincipal(p);
  return SKILLS.filter((s) => admin || !s.admin);
}

export function findSkill(p: Principal, name: string): Skill | undefined {
  return visibleSkills(p).find((s) => s.name === name);
}

export function skillUri(s: Skill): string {
  return `${SKILL_URI_PREFIX}${s.name}`;
}

export function renderSkill(s: Skill): string {
  const tools = ALL_TOOLS.filter((t) => s.groups.includes(t.group));
  return [
    '---',
    `name: ${s.name}`,
    `description: ${s.description}`,
    '---',
    '',
    `# ${s.name}`,
    s.intro.trimEnd(),
    '',
    '## Tool reference',
    '',
    tools.map(renderTool).join('\n\n'),
    '',
  ].join('\n');
}

const SKILL_TOOLS: ToolDef[] = [
  tool({
    name: 'list_skills',
    title: 'List skills',
    description:
      'Lists the skills this server offers: short manuals explaining how to use its tools, ' +
      'with workflows, permission requirements and pitfalls. Call this before using the other ' +
      'tools for the first time, then load the relevant one with get_skill.',
    admin: false,
    requires: 'any valid key (admin skills are listed for admin keys only)',
    group: 'general',
    input: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async ({ principal }) => ({
      skills: visibleSkills(principal).map((s) => ({
        name: s.name,
        description: s.description,
        audience: s.admin ? 'admin' : 'all',
        uri: skillUri(s),
        tools: ALL_TOOLS.filter((t) => s.groups.includes(t.group)).map((t) => t.name),
      })),
    }),
  }),
  tool({
    name: 'get_skill',
    title: 'Read a skill',
    description:
      'Returns one skill as Markdown: the workflow to follow, then a reference entry for ' +
      'every tool it covers (purpose, required permission, arguments).',
    admin: false,
    requires: 'any valid key (admin skills need an admin key)',
    group: 'general',
    input: z.object({ name: z.string().min(1).describe('Skill name, from list_skills') }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async ({ principal }, { name }) => {
      const skill = findSkill(principal, name);
      if (!skill) {
        throw new ToolError(
          'not_found',
          `No skill named "${name}". Available: ${visibleSkills(principal)
            .map((s) => s.name)
            .join(', ')}`,
        );
      }
      return renderSkill(skill);
    },
  }),
];

export const ALL_TOOLS: ToolDef[] = [...SKILL_TOOLS, ...FEATURE_TOOLS];

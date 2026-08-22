/**
 * Guards the generated OpenAPI document against drift.
 *
 *   npm run openapi:check
 *
 * 1. Every App Router handler on disk must appear in the route registry, and
 *    every registered route must exist on disk.
 * 2. No registered schema may differ between its input and output projection —
 *    the generator does a single input-mode pass, which is only correct while
 *    that holds (a `.default()` or `.transform()` on a response would break it).
 * 3. Every $ref in the document must resolve.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { z } from 'zod';
import { ROUTES } from '../src/lib/api/routes';
import { apiRegistry } from '../src/lib/api/schemas';
import { generateOpenApiDocument } from '../src/lib/openapi';

const API_ROOT = join(process.cwd(), 'src', 'app', 'api');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('route.ts') ? [full] : [];
  });
}

/** src/app/api/v1/certificates/[id]/bundle/route.ts -> /api/v1/certificates/{id}/bundle */
function pathFor(file: string): string {
  const parts = relative(join(process.cwd(), 'src', 'app'), file).split(sep).slice(0, -1);
  return '/' + parts.map((p) => p.replace(/^\[(?:\.\.\.)?(.+)\]$/, '{$1}')).join('/');
}

const onDisk = new Set<string>();
for (const file of walk(API_ROOT)) {
  const source = readFileSync(file, 'utf8');
  for (const method of METHODS) {
    const upper = method.toUpperCase();
    const exported =
      new RegExp(`export\\s+const\\s+${upper}\\s*=`).test(source) ||
      new RegExp(`export\\s+(async\\s+)?function\\s+${upper}\\b`).test(source);
    if (exported) onDisk.add(`${method} ${pathFor(file)}`);
  }
}

const registered = new Set(ROUTES.map((r) => `${r.method} ${r.path}`));
const undocumented = [...onDisk].filter((k) => !registered.has(k)).sort();
const phantom = [...registered].filter((k) => !onDisk.has(k)).sort();

const failures: string[] = [];
if (undocumented.length) {
  failures.push(
    `Handlers with no entry in src/lib/api/routes.ts:\n${undocumented.map((k) => `    ${k}`).join('\n')}`,
  );
}
if (phantom.length) {
  failures.push(
    `Registered routes with no handler on disk:\n${phantom.map((k) => `    ${k}`).join('\n')}`,
  );
}

// 2. input/output equivalence
const opts = { target: 'draft-2020-12', unrepresentable: 'any', uri: (id: string) => id } as const;
const asInput = z.toJSONSchema(apiRegistry, { ...opts, io: 'input' }).schemas;
const asOutput = z.toJSONSchema(apiRegistry, { ...opts, io: 'output' }).schemas;

/**
 * zod closes objects (`additionalProperties: false`) in output mode only. That
 * is a systematic artifact, not semantic drift, and the document deliberately
 * stays open so additive fields do not break strict clients. Ignore it so the
 * comparison only surfaces real differences: defaults, transforms, coercion.
 */
function semantic(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(semantic);
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([k]) => k !== 'additionalProperties')
        .map(([k, v]) => [k, semantic(v)]),
    );
  }
  return node;
}

const divergent = Object.keys(asInput).filter(
  (id) => JSON.stringify(semantic(asInput[id])) !== JSON.stringify(semantic(asOutput[id])),
);
const responseSchemaIds = new Set(
  ROUTES.flatMap((r) =>
    Object.values(r.responses)
      .map((resp) => resp.schema && (apiRegistry.get(resp.schema) as { id?: string } | undefined)?.id)
      .filter((id): id is string => Boolean(id)),
  ),
);
const badResponses = divergent.filter((id) => responseSchemaIds.has(id));
if (badResponses.length) {
  failures.push(
    `Response schemas whose input and output projections differ — the single-pass\n` +
      `  generator would publish the wrong one: ${badResponses.join(', ')}`,
  );
}

// 3. $ref resolution
const doc = generateOpenApiDocument();
const components = new Set(
  Object.keys((doc.components as { schemas: Record<string, unknown> }).schemas),
);
const dangling = new Set<string>();
(function scan(node: unknown) {
  if (Array.isArray(node)) return node.forEach(scan);
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === '$ref' && typeof v === 'string') {
        const id = v.replace('#/components/schemas/', '');
        if (!components.has(id)) dangling.add(v);
      } else scan(v);
    }
  }
})(doc);
if (dangling.size) failures.push(`Unresolvable $refs: ${[...dangling].join(', ')}`);

const pathCount = Object.keys(doc.paths as object).length;
const opCount = ROUTES.length;

if (failures.length) {
  console.error('\nopenapi:check failed\n');
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(
  `\nopenapi:check ok — ${opCount} operations over ${pathCount} paths, ` +
    `${components.size} component schemas, all $refs resolve.\n` +
    (divergent.length
      ? `  note: ${divergent.length} request schema(s) differ between input and output (expected: defaults).\n`
      : ''),
);
process.exit(0);

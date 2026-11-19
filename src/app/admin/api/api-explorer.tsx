'use client';

import { useMemo, useState } from 'react';
import { Button, Panel } from '@/components/ui';
import { useT } from '@/lib/i18n/client';

/* Minimal structural typing over the spec — enough to drive the UI without
   dragging in an OpenAPI type package for a document we author ourselves. */
type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  required?: string[];
  description?: string;
  additionalProperties?: Schema | boolean;
  $ref?: string;
};
type Param = {
  name: string;
  in: 'path' | 'query' | 'header';
  required?: boolean;
  schema?: Schema;
  description?: string;
  example?: string;
};
type Operation = {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: Param[];
  requestBody?: { required?: boolean; content?: Record<string, { schema?: Schema }> };
  responses?: Record<string, { description?: string }>;
  security?: unknown[];
};
type PathItem = Record<string, Operation | Param[] | undefined> & { parameters?: Param[] };

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
type Method = (typeof METHODS)[number];

const METHOD_STYLE: Record<Method, string> = {
  get: 'border-info/40 bg-info/10 text-info',
  post: 'border-accent/40 bg-accent/10 text-accent',
  put: 'border-warn/40 bg-warn/10 text-warn',
  patch: 'border-warn/40 bg-warn/10 text-warn',
  delete: 'border-danger/40 bg-danger/10 text-danger',
};

/**
 * The generated document refs shared schemas into components, so anything that
 * walks a schema has to follow them first.
 */
function makeResolver(spec: Record<string, unknown>) {
  const components = ((spec.components as { schemas?: Record<string, Schema> })?.schemas ??
    {}) as Record<string, Schema>;
  return function resolve(schema: Schema | undefined, seen = new Set<string>()): Schema | undefined {
    if (!schema?.$ref) return schema;
    const id = schema.$ref.replace('#/components/schemas/', '');
    // A self-referencing component would otherwise spin forever.
    if (seen.has(id)) return undefined;
    seen.add(id);
    return resolve(components[id], seen);
  };
}

type Resolver = ReturnType<typeof makeResolver>;

/** Builds a runnable example body from a JSON Schema fragment. */
function exampleFor(raw: Schema | undefined, resolve: Resolver, depth = 0): unknown {
  const schema = resolve(raw);
  if (!schema || depth > 4) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];

  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
  switch (type) {
    case 'object': {
      if (!schema.properties) return {};
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(schema.properties)) {
        // Keep the sample tight: required fields, plus anything self-documenting.
        const resolved = resolve(v) ?? v;
        if (
          schema.required?.includes(k) ||
          resolved.example !== undefined ||
          resolved.default !== undefined
        ) {
          out[k] = exampleFor(v, resolve, depth + 1);
        }
      }
      return out;
    }
    case 'array':
      return [exampleFor(schema.items, resolve, depth + 1)].filter((v) => v !== null);
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'string':
      return '';
    default:
      return null;
  }
}

function typeLabel(raw: Schema | undefined, resolve?: Resolver): string {
  const schema = resolve ? resolve(raw) : raw;
  if (!schema) return '';
  if (schema.enum?.length) return schema.enum.join(' | ');
  const t = Array.isArray(schema.type) ? schema.type.join('|') : schema.type;
  return t ?? '';
}

export function ApiExplorer({ spec }: { spec: Record<string, unknown> }) {
  const t = useT();
  const info = spec.info as { title: string; version: string; description?: string };
  const tags = (spec.tags ?? []) as Array<{ name: string; description?: string }>;
  const paths = (spec.paths ?? {}) as Record<string, PathItem>;
  const resolve = useMemo(() => makeResolver(spec), [spec]);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const byTag = new Map<string, Array<{ path: string; method: Method; op: Operation; shared: Param[] }>>();
    for (const [path, item] of Object.entries(paths)) {
      const shared = (item.parameters ?? []) as Param[];
      for (const method of METHODS) {
        const op = item[method] as Operation | undefined;
        if (!op) continue;
        const tag = op.tags?.[0] ?? 'Other';
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag)!.push({ path, method, op, shared });
      }
    }
    return byTag;
  }, [paths]);

  const needle = filter.trim().toLowerCase();
  const order = [...tags.map((t) => t.name), ...[...grouped.keys()].filter((t) => !tags.some((x) => x.name === t))];

  return (
    <div className="space-y-5">
      <Panel title={`${info.title} — API v${info.version}`}>
        {info.description && (
          <p className="whitespace-pre-line text-xs leading-relaxed text-ink-300">{info.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t.api.filterPlaceholder}
            className="min-w-56 flex-1 rounded border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-ink-100 outline-none placeholder:text-ink-600 focus:border-accent/60"
          />
          <a
            href="/api/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="rounded border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs text-ink-100 hover:border-ink-400"
          >
            openapi.json
          </a>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-600">
          {t.api.sendNote}
        </p>
      </Panel>

      {order.map((tag) => {
        const ops = (grouped.get(tag) ?? []).filter(
          (o) =>
            !needle ||
            o.path.toLowerCase().includes(needle) ||
            (o.op.summary ?? '').toLowerCase().includes(needle) ||
            tag.toLowerCase().includes(needle),
        );
        if (ops.length === 0) return null;
        const meta = tags.find((t) => t.name === tag);
        return (
          <Panel key={tag} title={tag}>
            {meta?.description && <p className="mb-3 text-[11px] text-ink-400">{meta.description}</p>}
            <div className="space-y-1.5">
              {ops.map((o) => {
                const key = `${o.method} ${o.path}`;
                return (
                  <div key={key} className="rounded border border-ink-800 bg-ink-950/60">
                    <button
                      onClick={() => setOpen(open === key ? null : key)}
                      className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left"
                    >
                      <span
                        className={`w-16 shrink-0 rounded border px-1.5 py-0.5 text-center text-[11px] ${METHOD_STYLE[o.method]}`}
                      >
                        {o.method}
                      </span>
                      <code className="text-ink-100">{o.path}</code>
                      <span className="text-[11px] text-ink-400">{o.op.summary}</span>
                    </button>
                    {open === key && <OperationPanel {...o} resolve={resolve} />}
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function OperationPanel({
  path,
  method,
  op,
  shared,
  resolve,
}: {
  path: string;
  method: Method;
  op: Operation;
  shared: Param[];
  resolve: Resolver;
}) {
  const t = useT();
  const params = [...shared, ...(op.parameters ?? [])];
  const bodySchema = op.requestBody?.content?.['application/json']?.schema;

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      params.map((p) => [p.name, String(p.example ?? resolve(p.schema)?.default ?? '')]),
    ),
  );
  const [body, setBody] = useState(() =>
    bodySchema ? JSON.stringify(exampleFor(bodySchema, resolve), null, 2) : '',
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: number; ms: number; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildUrl(): string {
    let url = path;
    for (const p of params.filter((x) => x.in === 'path')) {
      url = url.replace(`{${p.name}}`, encodeURIComponent(values[p.name] ?? ''));
    }
    const qs = new URLSearchParams();
    for (const p of params.filter((x) => x.in === 'query')) {
      const v = values[p.name];
      // A metadata.<key> placeholder is a template, not a real parameter name.
      if (v) qs.set(p.name.replace('<key>', ''), v);
    }
    const query = qs.toString();
    return query ? `${url}?${query}` : url;
  }

  function curl(): string {
    const headers = params
      .filter((p) => p.in === 'header' && values[p.name])
      .map((p) => ` \\\n  -H '${p.name}: ${values[p.name]}'`)
      .join('');
    const data =
      bodySchema && method !== 'get' && body.trim() ? ` \\\n  -d '${body.replace(/\n\s*/g, '')}'` : '';
    const ct = data ? " \\\n  -H 'content-type: application/json'" : '';
    return `curl -X ${method.toUpperCase()} '${buildUrl()}'${ct} \\\n  -H "Authorization: Bearer $TOKEN"${headers}${data}`;
  }

  async function send() {
    setBusy(true);
    setError(null);
    setResult(null);
    const started = performance.now();
    try {
      const headers: Record<string, string> = {};
      for (const p of params.filter((x) => x.in === 'header')) {
        if (values[p.name]) headers[p.name] = values[p.name];
      }
      let payload: string | undefined;
      if (bodySchema && method !== 'get' && body.trim()) {
        JSON.parse(body); // fail here rather than sending malformed JSON
        payload = body;
        headers['content-type'] = 'application/json';
      }
      const res = await fetch(buildUrl(), { method: method.toUpperCase(), headers, body: payload });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* not JSON — PEM downloads and SSE come through as-is */
      }
      setResult({ status: res.status, ms: Math.round(performance.now() - started), text: pretty });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-ink-800 px-3 py-3">
      {op.description && (
        <p className="whitespace-pre-line text-[11px] leading-relaxed text-ink-400">{op.description}</p>
      )}

      {params.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-ink-400">{t.api.parameters}</p>
          {params.map((p) => (
            <label key={`${p.in}-${p.name}`} className="block">
              <span className="mb-1 flex flex-wrap items-baseline gap-1.5 text-[11px]">
                <code className="text-ink-100">{p.name}</code>
                <span className="text-ink-600">
                  {p.in}
                  {p.required ? ` · ${t.api.requiredTag}` : ''}
                  {typeLabel(p.schema, resolve) ? ` · ${typeLabel(p.schema, resolve)}` : ''}
                </span>
                {p.description && <span className="text-ink-400">{p.description}</span>}
              </span>
              <input
                value={values[p.name] ?? ''}
                onChange={(e) => setValues({ ...values, [p.name]: e.target.value })}
                placeholder={String(p.example ?? '')}
                className="w-full rounded border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100 outline-none placeholder:text-ink-600 focus:border-accent/60"
              />
            </label>
          ))}
        </div>
      )}

      {bodySchema && method !== 'get' && (
        <div>
          <p className="mb-1 text-[11px] text-ink-400">
            {t.api.body} {op.requestBody?.required ? `· ${t.api.requiredTag}` : `· ${t.api.optionalTag}`}
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={Math.min(16, body.split('\n').length + 1)}
            spellCheck={false}
            className="w-full rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-[11px] leading-relaxed text-ink-100 outline-none focus:border-accent/60"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={send} disabled={busy}>
          {busy ? t.api.sending : t.api.send}
        </Button>
        <code className="truncate text-[11px] text-ink-600">{buildUrl()}</code>
      </div>

      <details className="text-[11px]">
        <summary className="cursor-pointer text-ink-400 hover:text-ink-100">{t.api.curlEquivalent}</summary>
        <pre className="mt-1 overflow-x-auto rounded border border-ink-800 bg-ink-950 p-2 text-ink-300">
          {curl()}
        </pre>
      </details>

      {error && (
        <p className="rounded border border-danger/40 bg-danger/10 px-2 py-1.5 text-[11px] text-danger">
          {error}
        </p>
      )}

      {result && (
        <div>
          <p className="mb-1 flex items-center gap-2 text-[11px]">
            <span
              className={
                result.status < 300 ? 'text-accent' : result.status < 500 ? 'text-warn' : 'text-danger'
              }
            >
              {result.status}
            </span>
            <span className="text-ink-600">{result.ms} ms</span>
          </p>
          <pre className="max-h-80 overflow-auto rounded border border-ink-800 bg-ink-950 p-2 text-[11px] leading-relaxed text-ink-300">
            {result.text || t.api.emptyBody}
          </pre>
        </div>
      )}

      {op.responses && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-600">
          {Object.entries(op.responses).map(([code, r]) => (
            <span key={code}>
              <span className="text-ink-400">{code}</span> {r.description}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

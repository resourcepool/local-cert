import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/http';
import type { Principal } from '@/lib/auth/guard';
import { ToolError, inputSchemaOf, isAdminPrincipal, type ToolContext, type ToolDef } from './tools';
import {
  ALL_TOOLS,
  SKILL_URI_PREFIX,
  findSkill,
  renderSkill,
  skillUri,
  visibleSkills,
} from './skills';

/**
 * A stateless MCP server over the Streamable HTTP transport: every JSON-RPC
 * message is answered from the request alone, so there is no session to keep
 * and any replica can serve any call. The server never initiates messages,
 * which is why the transport needs no SSE stream.
 */

/** Newest first. An unknown client version is answered with the newest. */
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const SERVER_INFO = { name: 'local-cert', title: 'local-cert', version: '0.1.0' };

const INSTRUCTIONS =
  "local-cert issues Let's Encrypt certificates for LAN hosts through Route53 DNS-01 and " +
  'manages the related DNS records. Before using the tools for the first time, call ' +
  'list_skills and read the relevant skill with get_skill: skills explain the workflows, the ' +
  'permission each tool needs and the pitfalls. Call whoami to see which domains and scopes ' +
  'the current API key has.';

type JsonRpcId = string | number | null;

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;
/** MCP's code for a resources/read on an unknown URI */
const RESOURCE_NOT_FOUND = -32002;

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

export function rpcError(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function visibleTools(p: Principal): ToolDef[] {
  const admin = isAdminPrincipal(p);
  return ALL_TOOLS.filter((t) => admin || !t.admin);
}

/**
 * Admin tools mint keys and delete domains, so the claim in a token is not
 * enough: a JWT exchanged from a key keeps saying "admin" until it expires,
 * even after the key was revoked or demoted. Re-read the key before each call.
 * Console-session tokens (kind "user") have no key row; their claim stands, as
 * it does for the console's own admin routes.
 */
async function requireLiveAdmin(p: Principal): Promise<void> {
  if (!isAdminPrincipal(p)) throw new ToolError('forbidden', 'Admin privileges required');
  if (p.kind !== 'key') return;
  const row = await db()
    .selectFrom('api_keys')
    .select(['is_admin', 'revoked_at', 'expires_at'])
    .where('id', '=', p.keyId)
    .executeTakeFirst();
  const live =
    row &&
    row.is_admin === 1 &&
    !row.revoked_at &&
    !(row.expires_at && new Date(row.expires_at) < new Date());
  if (!live) throw new ToolError('forbidden', 'Admin privileges required');
}

function toolFailure(type: string, message: string, detail?: unknown) {
  const body = { error: type, message, ...(detail !== undefined ? { detail } : {}) };
  return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], isError: true };
}

async function callTool(ctx: ToolContext, params: unknown) {
  const { name, arguments: args } = (params ?? {}) as { name?: unknown; arguments?: unknown };
  const def = typeof name === 'string' ? ALL_TOOLS.find((t) => t.name === name) : undefined;
  // An admin tool is reported as unknown to a non-admin key, consistent with
  // tools/list not showing it.
  if (!def || (def.admin && !isAdminPrincipal(ctx.principal))) {
    throw new RpcError(INVALID_PARAMS, `Unknown tool: ${String(name)}`);
  }

  try {
    if (def.admin) await requireLiveAdmin(ctx.principal);

    const parsed = def.input.safeParse(args ?? {});
    if (!parsed.success) {
      return toolFailure('validation_error', 'Invalid arguments', z.treeifyError(parsed.error));
    }

    const result = await def.run(ctx, parsed.data);
    if (typeof result === 'string') return { content: [{ type: 'text', text: result }] };
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  } catch (err) {
    // Reported in the result, not as a protocol error, so the model can read
    // the reason and correct itself.
    if (err instanceof ToolError || err instanceof ApiError) {
      return toolFailure(err.type, err.message, err.detail);
    }
    console.error(`[mcp] tool ${def.name} failed`, err);
    return toolFailure('internal_error', 'Unexpected server error');
  }
}

async function dispatch(method: string, params: unknown, ctx: ToolContext): Promise<unknown> {
  switch (method) {
    case 'initialize': {
      const requested = (params as { protocolVersion?: unknown } | undefined)?.protocolVersion;
      return {
        protocolVersion:
          typeof requested === 'string' && PROTOCOL_VERSIONS.includes(requested)
            ? requested
            : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {}, resources: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      };
    }

    case 'ping':
      return {};

    case 'tools/list':
      return {
        tools: visibleTools(ctx.principal).map((t) => ({
          name: t.name,
          title: t.title,
          description: `${t.description} Requires: ${t.requires}.`,
          inputSchema: inputSchemaOf(t),
          annotations: { title: t.title, ...t.annotations },
        })),
      };

    case 'tools/call':
      return callTool(ctx, params);

    case 'resources/list':
      return {
        resources: visibleSkills(ctx.principal).map((s) => ({
          uri: skillUri(s),
          name: s.name,
          title: s.name,
          description: s.description,
          mimeType: 'text/markdown',
        })),
      };

    case 'resources/templates/list':
      return { resourceTemplates: [] };

    case 'resources/read': {
      const uri = (params as { uri?: unknown } | undefined)?.uri;
      const skill =
        typeof uri === 'string' && uri.startsWith(SKILL_URI_PREFIX)
          ? findSkill(ctx.principal, uri.slice(SKILL_URI_PREFIX.length))
          : undefined;
      if (!skill) throw new RpcError(RESOURCE_NOT_FOUND, 'Resource not found', { uri });
      return {
        contents: [{ uri: skillUri(skill), mimeType: 'text/markdown', text: renderSkill(skill) }],
      };
    }

    default:
      throw new RpcError(METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

/**
 * Handles one JSON-RPC message. Returns null for notifications and for
 * responses, neither of which is answered.
 */
export async function handleMessage(
  message: unknown,
  ctx: ToolContext,
): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return rpcError(null, INVALID_REQUEST, 'Invalid request');
  }
  const { jsonrpc, id, method, params } = message as Record<string, unknown>;
  const hasId = typeof id === 'string' || typeof id === 'number';

  if (jsonrpc !== '2.0') return rpcError(hasId ? id : null, INVALID_REQUEST, 'Invalid request');
  if (typeof method !== 'string') {
    // A response to a request we never sent: nothing to do.
    if ('result' in message || 'error' in message) return null;
    return rpcError(hasId ? id : null, INVALID_REQUEST, 'Invalid request');
  }
  if (!hasId) return null; // notification

  try {
    return { jsonrpc: '2.0', id, result: await dispatch(method, params, ctx) };
  } catch (err) {
    if (err instanceof RpcError) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: err.code,
          message: err.message,
          ...(err.data !== undefined ? { data: err.data } : {}),
        },
      };
    }
    console.error(`[mcp] ${method} failed`, err);
    return rpcError(id, INTERNAL_ERROR, 'Internal error');
  }
}

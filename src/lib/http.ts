import { NextResponse } from 'next/server';

export type ProblemType =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_error'
  | 'rate_limited'
  | 'setup_required'
  | 'upstream_error'
  | 'internal_error';

const STATUS: Record<ProblemType, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation_error: 422,
  rate_limited: 429,
  setup_required: 503,
  upstream_error: 502,
  internal_error: 500,
};

export class ApiError extends Error {
  constructor(
    readonly type: ProblemType,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

/** RFC 9457-ish error body. */
export function problem(type: ProblemType, message: string, detail?: unknown) {
  return NextResponse.json(
    { type, title: message, status: STATUS[type], ...(detail ? { detail } : {}) },
    {
      status: STATUS[type],
      headers:
        type === 'unauthorized'
          ? { 'WWW-Authenticate': 'Bearer realm="local-cert"' }
          : undefined,
    },
  );
}

export function ok<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

/** Wraps a handler so thrown ApiErrors become clean problem responses. */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return problem(err.type, err.message, err.detail);
      console.error('[api] unhandled', err);
      return problem('internal_error', 'Unexpected server error');
    }
  };
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

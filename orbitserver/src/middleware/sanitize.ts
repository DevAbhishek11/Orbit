/**
 * NoSQL-injection sanitizer (replaces express-mongo-sanitize, which is
 * unmaintained and broken on Express 5 — `req.query` is getter-only there).
 *
 * Recursively strips keys starting with '$' or containing '.' from body,
 * params and query. Combined with the Zod `validate()` middleware (which
 * REJECTS such keys outright on validated routes) this is defence in depth.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

const MAX_DEPTH = 8;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined; // absurd nesting is itself hostile
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v, depth + 1)).filter((v) => v !== undefined);
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) continue; // drop operator keys
      const cleaned = sanitizeValue(v, depth + 1);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return value;
}

export function sanitizeNoSql(req: Request, _res: Response, next: NextFunction): void {
  req.body = sanitizeValue(req.body) ?? {};
  req.params = sanitizeValue(req.params) as Request['params'];
  // Express 5: query is a prototype getter — define an own sanitized value.
  const query = sanitizeValue(req.query) ?? {};
  Object.defineProperty(req, 'query', {
    value: query,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
}

export const sanitizeMiddleware: RequestHandler = sanitizeNoSql;

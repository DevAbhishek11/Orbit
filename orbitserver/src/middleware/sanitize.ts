import type { NextFunction, Request, RequestHandler, Response } from 'express';

const MAX_DEPTH = 8;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v, depth + 1)).filter((v) => v !== undefined);
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) continue;
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

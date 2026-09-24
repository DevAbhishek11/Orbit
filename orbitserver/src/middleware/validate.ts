/**
 * Zod validation middleware (BUILD_PROMPT Phase 4, rule 14):
 * strict objects, unknown keys stripped, 422 with per-field issues,
 * sanitized against NoSQL operator injection for params/query/bodies.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { validationFailed } from '../infrastructure/errors/ApiError.js';

export interface ValidateSchemas {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
}

/** Recursively reject keys starting with '$' or containing '.' (NoSQL injection). */
function containsOperatorKeys(value: unknown, depth = 0): boolean {
  if (depth > 6) return true; // absurd nesting is itself suspicious
  if (Array.isArray(value)) return value.some((v) => containsOperatorKeys(v, depth + 1));
  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) return true;
      if (containsOperatorKeys((value as Record<string, unknown>)[key], depth + 1)) return true;
    }
  }
  return false;
}

export function validate(schemas: ValidateSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const issues: Array<{ path: string; message: string; code?: string }> = [];

    const runPart = (
      part: 'params' | 'query' | 'body',
      source: unknown,
    ): unknown => {
      const schema = schemas[part];
      if (!schema) return source;
      if (containsOperatorKeys(source)) {
        issues.push({ path: part, message: 'Illegal operator key in input', code: 'nosql_injection' });
        return undefined;
      }
      const result = schema.safeParse(source) as
        | { success: true; data: unknown }
        | { success: false; error: { issues: Array<{ path: (string | number)[]; message: string; code: string }> } };
      if (!result.success) {
        for (const issue of result.error.issues) {
          issues.push({
            path: `${part}${issue.path.length ? '.' + issue.path.join('.') : ''}`,
            message: issue.message,
            code: issue.code,
          });
        }
        return undefined;
      }
      return result.data;
    };

    const params = runPart('params', req.params);
    const query = runPart('query', req.query);
    const body = runPart('body', req.body);

    if (issues.length > 0) {
      next(validationFailed(issues));
      return;
    }

    if (schemas.params) req.params = params as Request['params'];
    if (schemas.query) {
      // Express 5 query is a getter on the prototype — define an own property.
      Object.defineProperty(req, 'query', {
        value: query as z.output<ZodTypeAny>,
        writable: true,
        configurable: true,
      });
    }
    if (schemas.body) req.body = body;
    next();
  };
}

/**
 * Typed input helpers — controllers/middleware read `req.body` and
 * `req.cookies` (both `any` in Express types) through these seams so the
 * rest of the codebase never touches an untyped value (rule 16: no any).
 * Validation middleware re-parses bodies with Zod before controllers run;
 * these helpers are the typed view of the validated result.
 */
import type { Request } from 'express';

export function typedBody<T>(req: Request): T {
  const body: unknown = req.body;
  return body as T;
}

export function typedCookie(req: Request, name: string): string | undefined {
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) return undefined;
  const value = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function typedQuery<T>(req: Request): T {
  const query: unknown = req.query;
  return query as T;
}

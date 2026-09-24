/**
 * Response envelope helpers — the ONLY way routes answer (BUILD_PROMPT §4).
 *   success: { success: true, data, meta: { requestId, nextCursor?, cached? } }
 *   error:   { success: false, error: { code, message, details?, requestId } }
 */
import type { Response } from 'express';
import type { ResponseMeta } from '@orbit/shared';
import { getRequestContext } from '../logger/requestContext.js';

function currentRequestId(): string {
  return getRequestContext().requestId ?? '-';
}

export interface SendOkOptions {
  status?: number;
  nextCursor?: string | null;
  cached?: boolean;
  headers?: Record<string, string | number>;
}

export function ok<T>(res: Response, data: T, options: SendOkOptions = {}): Response {
  const meta: ResponseMeta = { requestId: currentRequestId() };
  if (options.nextCursor !== undefined) meta.nextCursor = options.nextCursor;
  if (options.cached !== undefined) meta.cached = options.cached;
  for (const [key, value] of Object.entries(options.headers ?? {})) {
    res.setHeader(key, String(value));
  }
  return res.status(options.status ?? 200).json({ success: true, data, meta });
}

export function created<T>(res: Response, data: T, options: SendOkOptions = {}): Response {
  return ok(res, data, { ...options, status: 201 });
}

export function accepted<T>(res: Response, data: T): Response {
  return ok(res, data, { status: 202 });
}

export function noContent(res: Response): Response {
  res.setHeader('X-Request-Id', currentRequestId());
  return res.status(204).send();
}

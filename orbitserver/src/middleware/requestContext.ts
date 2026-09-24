/**
 * Per-request context: uuid-v7 requestId (time-sortable), ALS binding and the
 * X-Request-Id response header so clients can quote it in bug reports and the
 * error envelope always carries it (BUILD_PROMPT Phase 2).
 */
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { enrichRequestContext, runWithRequestContext } from '../infrastructure/logger/requestContext.js';

export const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthContext;
    }
  }
}

/** What authenticate.ts attaches after verifying the access token. */
export interface AuthContext {
  userId: string;
  /** Active workspace from the token (`wid` claim) — may be undefined pre-selection. */
  workspaceId?: string;
  role?: string;
  jti: string;
  tokenVersion: number;
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerId = req.header(REQUEST_ID_HEADER);
  // Accept an upstream id only when it looks sane (no header injection).
  const requestId =
    headerId && /^[A-Za-z0-9_-]{8,64}$/.test(headerId) ? headerId : randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  runWithRequestContext(
    { requestId, ip: req.ip },
    () => {
      // Re-bind once the response finishes so late logs still correlate.
      res.on('finish', () => {
        enrichRequestContext({ requestId });
      });
      next();
    },
  );
}

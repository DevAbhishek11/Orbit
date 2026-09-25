import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  enrichRequestContext,
  runWithRequestContext,
} from '../infrastructure/logger/requestContext.js';

export const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthContext;
    }
  }
}

export interface AuthContext {
  userId: string;

  workspaceId?: string;
  role?: string;
  jti: string;
  tokenVersion: number;
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerId = req.header(REQUEST_ID_HEADER);

  const requestId = headerId && /^[A-Za-z0-9_-]{8,64}$/.test(headerId) ? headerId : randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  runWithRequestContext({ requestId, ip: req.ip }, () => {
    res.on('finish', () => {
      enrichRequestContext({ requestId });
    });
    next();
  });
}

/**
 * authenticate (BUILD_PROMPT Phase 4, layer 1 of RBAC):
 * bearer OR orbit_at cookie → verify JWT (signature, exp, iss, aud, typ)
 * → jti denylist → cached account snapshot (tokenVersion + status)
 * → attach req.auth + enrich the request context.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { COOKIES } from '@orbit/shared';
import { unauthenticated } from '../infrastructure/errors/ApiError.js';
import { cacheDel } from '../infrastructure/cache/cacheService.js';
import { enrichRequestContext } from '../infrastructure/logger/requestContext.js';
import { isJtiDenylisted, verifyAccessToken, type AccessTokenClaims } from '../modules/auth/tokens.service.js';
import { getAuthSnapshot } from '../modules/users/users.repository.js';
import { typedCookie } from '../infrastructure/http/input.js';
import type { AuthContext } from './requestContext.js';

export function extractAccessToken(req: Request): string | undefined {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return typedCookie(req, COOKIES.ACCESS);
}

const snapshotCacheKey = (userId: string): string => `auth:snapshot:${userId}`;

/** Drop the cached snapshot whenever tokenVersion/status changes. */
export async function invalidateAuthSnapshot(userId: string): Promise<void> {
  await cacheDel(snapshotCacheKey(userId));
}

async function loadSnapshot(userId: string): Promise<{ tokenVersion: number; status: string } | null> {
  return getAuthSnapshot(userId);
}

export function authenticate(options: { required?: boolean } = {}): RequestHandler {
  const required = options.required ?? true;
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = extractAccessToken(req);
    if (!token) {
      if (!required) return next();
      return next(unauthenticated());
    }

    const verified = verifyAccessToken(token);
    if (!verified.ok) {
      return next(
        verified.reason === 'expired'
          ? unauthenticated('Access token has expired')
          : unauthenticated('Access token is invalid'),
      );
    }

    const claims: AccessTokenClaims = verified.claims;

    if (await isJtiDenylisted(claims.jti)) {
      return next(unauthenticated('Access token has been revoked'));
    }

    const snapshot = await loadSnapshot(claims.sub);
    if (!snapshot) {
      return next(unauthenticated('Account no longer exists'));
    }
    if (snapshot.tokenVersion !== claims.ver) {
      return next(unauthenticated('Access token has been superseded — please refresh'));
    }
    if (snapshot.status === 'suspended' || snapshot.status === 'deleted') {
      return next(unauthenticated('Account is suspended'));
    }

    const auth: AuthContext = {
      userId: claims.sub,
      workspaceId: claims.wid,
      role: claims.role,
      jti: claims.jti,
      tokenVersion: claims.ver,
    };
    req.auth = auth;
    enrichRequestContext({ userId: auth.userId, workspaceId: auth.workspaceId, role: auth.role });
    next();
  };
}

/** Convenience: routes that need a definitely-present req.auth. */
export function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthenticated();
  return req.auth;
}

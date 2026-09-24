/**
 * Auth controller — HTTP plumbing only (no business logic, no Mongoose).
 * Refresh tokens live in an httpOnly cookie scoped to /api/v1/auth; the
 * access token is returned in the body for SPA memory storage.
 */
import type { Request, Response } from 'express';
import { COOKIES } from '@orbit/shared';
import { env } from '../../config/env.js';
import { created, noContent, ok } from '../../infrastructure/http/response.js';
import { typedBody, typedCookie } from '../../infrastructure/http/input.js';
import { invalidateAuthSnapshot, requireAuth } from '../../middleware/authenticate.js';
import * as authService from './auth.service.js';
import type {
  ForgotPasswordInput,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from './auth.schema.js';
import type { AuthResult } from './auth.service.js';

function requestContext(req: Request): authService.RequestContext {
  return {
    ip: req.ip,
    userAgent: req.header('user-agent')?.slice(0, 400),
    device: req.header('user-agent')?.split('(')[1]?.split(')')[0]?.slice(0, 120),
  };
}

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(COOKIES.REFRESH, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/api/v1/auth',
    expires: expiresAt,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(COOKIES.REFRESH, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/api/v1/auth',
  });
}

function shapeAuthResult(result: AuthResult): Record<string, unknown> {
  return {
    user: result.user,
    accessToken: result.tokens.accessToken,
    accessExpiresIn: result.tokens.accessExpiresIn,
    workspaceId: result.workspaceId,
    role: result.role,
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(typedBody<RegisterInput>(req), requestContext(req));
  setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshExpiresAt);
  created(res, shapeAuthResult(result));
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(typedBody<LoginInput>(req), requestContext(req));
  setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshExpiresAt);
  ok(res, shapeAuthResult(result));
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const body = typedBody<RefreshInput>(req);
  const cookieToken = typedCookie(req, COOKIES.REFRESH);
  const rawToken = cookieToken ?? body.refreshToken;
  const result = await authService.refresh(rawToken, {
    ...requestContext(req),
    workspaceId: body.workspaceId,
  });
  setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshExpiresAt);
  ok(res, shapeAuthResult(result));
}

export async function logout(req: Request, res: Response): Promise<void> {
  const auth = req.auth;
  const body = typedBody<LogoutInput | undefined>(req);
  const cookieToken = typedCookie(req, COOKIES.REFRESH);
  const bearer = req.header('authorization');
  await authService.logout(
    bearer?.startsWith('Bearer ') ? bearer.slice(7) : undefined,
    cookieToken,
    body?.allDevices ?? false,
    { userId: auth?.userId, ip: req.ip },
  );
  if (body?.allDevices && auth) await invalidateAuthSnapshot(auth.userId);
  clearRefreshCookie(res);
  noContent(res);
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await authService.forgotPassword(typedBody<ForgotPasswordInput>(req), { ip: req.ip });
  // Always the same answer — never reveal whether the account exists.
  ok(res, { sent: true });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await authService.resetPassword(typedBody<ResetPasswordInput>(req), { ip: req.ip });
  clearRefreshCookie(res);
  ok(res, { reset: true });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const result = await authService.verifyEmail((typedBody<VerifyEmailInput>(req)).token);
  ok(res, result);
}

export async function sessions(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const cookieToken = typedCookie(req, COOKIES.REFRESH);
  const list = await authService.getSessions(auth.userId, cookieToken);
  ok(res, { sessions: list });
}

export async function revokeSession(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const familyId = String(req.params.familyId ?? '');
  await authService.revokeSession(auth.userId, familyId);
  noContent(res);
}

export async function switchWorkspace(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const { workspaceId } = req.body as { workspaceId: string };
  const result = await authService.switchWorkspace(auth.userId, workspaceId);
  ok(res, result);
}

export function me(req: Request, res: Response): void {
  const auth = requireAuth(req);
  ok(res, {
    userId: auth.userId,
    workspaceId: auth.workspaceId ?? null,
    role: auth.role ?? null,
  });
}

/**
 * Auth service (BUILD_PROMPT Phase 3) — business logic only, no req/res.
 *
 * Security properties implemented here:
 *  - timing-safe login (dummy hash comparison for unknown emails)
 *  - account lockout after N failures for M minutes
 *  - generic error for wrong-email AND wrong-password (no enumeration)
 *  - rotating refresh tokens with family reuse detection (tokens.service)
 *  - logout denylist for immediate access-token death
 *  - single-use hashed tokens for email verification + password reset
 */
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError, unauthenticated } from '../../infrastructure/errors/ApiError.js';
import { childLogger } from '../../infrastructure/logger/index.js';
import { authEventsTotal } from '../../infrastructure/metrics/index.js';
import { sendMail } from '../../infrastructure/mail/mailer.js';
import { recordAudit } from '../audit/audit.service.js';
import { toPublicUser, type UserDoc } from '../users/users.model.js';
import {
  bumpTokenVersion,
  createUser,
  findUserByEmail,
  findUserByHandle,
  findUserById,
  findUserByTokenHash,
  markEmailVerified,
  recordFailedLogin,
  recordSuccessfulLogin,
  setResetToken,
  setVerificationToken,
  updatePasswordHash,
} from '../users/users.repository.js';
import { findMembership, findPrimaryMembership } from '../workspaces/workspaces.repository.js';
import { checkPasswordPolicy, getDummyHash, hashPassword, verifyPassword } from './passwords.js';
import {
  denylistJti,
  issueRefreshToken,
  listActiveSessions,
  revokeAllUserTokens,
  revokeFamily,
  revokeTokenByRaw,
  rotateRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from './tokens.service.js';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.schema.js';

const log = childLogger({ module: 'auth' });

export interface TokenBundle {
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AuthResult {
  user: Record<string, unknown>;
  tokens: TokenBundle;
  workspaceId: string | null;
  role: string | null;
}

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  device?: string;
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

async function resolveWorkspaceScope(
  userId: string,
  requestedWorkspaceId?: string,
): Promise<{ workspaceId?: string; role?: string }> {
  if (requestedWorkspaceId) {
    const membership = await findMembership(requestedWorkspaceId, userId);
    if (!membership) {
      throw new ApiError('NOT_A_MEMBER', 'You are not a member of this workspace', { status: 403 });
    }
    return { workspaceId: requestedWorkspaceId, role: membership.role };
  }
  const primary = await findPrimaryMembership(userId);
  return primary
    ? { workspaceId: primary.workspaceId, role: primary.role }
    : { workspaceId: undefined, role: undefined };
}

async function buildTokenBundle(
  user: UserDoc,
  options: RequestContext & { remember?: boolean; workspaceId?: string; familyId?: string } = {},
): Promise<{ tokens: TokenBundle; workspaceId: string | null; role: string | null }> {
  const scope = await resolveWorkspaceScope(String(user._id), options.workspaceId);
  const access = signAccessToken({
    userId: String(user._id),
    workspaceId: scope.workspaceId,
    role: scope.role,
    tokenVersion: user.tokenVersion,
  });
  const refresh = await issueRefreshToken({
    userId: String(user._id),
    familyId: options.familyId,
    remember: options.remember,
    device: options.device,
    userAgent: options.userAgent,
    ip: options.ip,
  });
  return {
    tokens: {
      accessToken: access.token,
      accessExpiresIn: access.expiresInSeconds,
      refreshToken: refresh.rawToken,
      refreshExpiresAt: refresh.expiresAt,
    },
    workspaceId: scope.workspaceId ?? null,
    role: scope.role ?? null,
  };
}

// ── register ──────────────────────────────────────────────────────────

export async function register(input: RegisterInput, context: RequestContext): Promise<AuthResult> {
  const policy = checkPasswordPolicy(input.password, { email: input.email, name: input.name });
  if (!policy.ok) {
    throw new ApiError('VALIDATION_ERROR', 'Password does not meet the policy', {
      status: 422,
      details: { issues: policy.reasons.map((message) => ({ path: 'password', message })) },
    });
  }

  if (await findUserByEmail(input.email)) {
    throw new ApiError('DUPLICATE_RESOURCE', 'An account with this email already exists', {
      status: 409,
    });
  }

  const passwordHash = await hashPassword(input.password);
  const handle = await uniqueHandle(input.handle ?? deriveHandle(input.email));
  const user = await createUser({
    email: input.email,
    passwordHash,
    name: input.name,
    handle,
    timezone: input.timezone ?? 'UTC',
    status: 'pending',
  });

  await issueVerificationToken(user);
  await recordAudit({
    actorId: String(user._id),
    action: 'auth.register',
    entityType: 'user',
    entityId: String(user._id),
    ip: context.ip,
    userAgent: context.userAgent,
  });

  const bundle = await buildTokenBundle(user, context);
  authEventsTotal.inc({ event: 'register' });
  return { user: toPublicUser(user), ...bundle };
}

function deriveHandle(email: string): string {
  const base = email
    .split('@')[0]!
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
  return base.length >= 3 ? base : `${base}${randomBytes(2).toString('hex')}`;
}

async function uniqueHandle(candidate: string): Promise<string> {
  const normalized = candidate.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'user';
  let handle = normalized.length >= 3 ? normalized : `${normalized}_u`;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!(await findUserByHandle(handle))) return handle;
    handle = `${normalized.slice(0, 22)}_${randomBytes(2).toString('hex')}`;
  }
  return `${normalized.slice(0, 18)}_${randomBytes(4).toString('hex')}`;
}

async function issueVerificationToken(user: UserDoc): Promise<void> {
  const raw = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 24 * 3_600 * 1000);
  await setVerificationToken(String(user._id), hashToken(raw), expiresAt);
  await sendMail({
    to: user.email,
    template: 'verify_email',
    subject: `Verify your ${env.APP_NAME} email`,
    vars: { name: user.name, url: `${env.APP_URL}/verify-email?token=${raw}` },
  });
}

// ── login (timing-safe + lockout) ─────────────────────────────────────

export async function login(input: LoginInput, context: RequestContext): Promise<AuthResult> {
  const user = await findUserByEmail(input.email, { withPassword: true });

  if (!user) {
    // Equalize timing: burn a real hash comparison even for unknown emails.
    await verifyPassword(await getDummyHash(), input.password);
    authEventsTotal.inc({ event: 'login_fail' });
    throw unauthenticated('Invalid email or password');
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const retryAfterSeconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
    authEventsTotal.inc({ event: 'lockout' });
    throw new ApiError('ACCOUNT_LOCKED', 'Account temporarily locked due to repeated failed logins', {
      headers: { 'Retry-After': String(retryAfterSeconds) },
      details: { lockedUntil: user.lockedUntil.toISOString() },
    });
  }

  if (user.status === 'suspended' || user.status === 'deleted') {
    authEventsTotal.inc({ event: 'login_fail' });
    throw new ApiError('FORBIDDEN_SCOPE', 'This account cannot sign in', { status: 403 });
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password);
  if (!passwordOk) {
    await recordFailedLogin(String(user._id), env.LOGIN_MAX_ATTEMPTS, env.LOGIN_LOCKOUT_MINUTES * 60_000);
    authEventsTotal.inc({ event: 'login_fail' });
    // Same message for wrong email and wrong password — no enumeration.
    throw unauthenticated('Invalid email or password');
  }

  await recordSuccessfulLogin(String(user._id));
  const fresh: UserDoc = { ...user, status: 'active' };
  const bundle = await buildTokenBundle(fresh, {
    ...context,
    remember: input.remember,
    workspaceId: input.workspaceId,
  });

  await recordAudit({
    actorId: String(user._id),
    action: 'auth.login',
    entityType: 'user',
    entityId: String(user._id),
    ip: context.ip,
    userAgent: context.userAgent,
  });
  authEventsTotal.inc({ event: 'login_ok' });
  return { user: toPublicUser(fresh), ...bundle };
}

// ── refresh (rotation + reuse detection) ──────────────────────────────

export async function refresh(
  rawToken: string | undefined,
  context: RequestContext & { workspaceId?: string },
): Promise<AuthResult> {
  if (!rawToken) throw unauthenticated('Refresh token missing');

  const rotated = await rotateRefreshToken(rawToken);
  if (!rotated.ok) {
    const code =
      rotated.reason === 'reused'
        ? 'TOKEN_REUSED'
        : rotated.reason === 'expired'
          ? 'TOKEN_EXPIRED'
          : rotated.reason === 'revoked'
            ? 'TOKEN_REVOKED'
            : 'UNAUTHENTICATED';
    authEventsTotal.inc({ event: rotated.reason === 'reused' ? 'reuse_detected' : 'refresh_fail' });
    throw new ApiError(code, 'Refresh token is no longer valid', { status: 401 });
  }

  const user = await findUserById(String(rotated.record.userId));
  if (!user || user.status === 'suspended' || user.status === 'deleted') {
    await revokeAllUserTokens(String(rotated.record.userId), 'account_unavailable');
    throw unauthenticated('Account is no longer active');
  }

  const scope = await resolveWorkspaceScope(String(user._id), context.workspaceId);
  const access = signAccessToken({
    userId: String(user._id),
    workspaceId: scope.workspaceId,
    role: scope.role,
    tokenVersion: user.tokenVersion,
  });

  authEventsTotal.inc({ event: 'refresh' });
  return {
    user: toPublicUser(user),
    tokens: {
      accessToken: access.token,
      accessExpiresIn: access.expiresInSeconds,
      refreshToken: rotated.rawToken,
      refreshExpiresAt: rotated.record.expiresAt,
    },
    workspaceId: scope.workspaceId ?? null,
    role: scope.role ?? null,
  };
}

// ── logout ────────────────────────────────────────────────────────────

export async function logout(
  accessToken: string | undefined,
  refreshTokenRaw: string | undefined,
  allDevices: boolean,
  context: { userId?: string; ip?: string },
): Promise<void> {
  // Denylist the presented access token for its remaining lifetime.
  if (accessToken) {
    const verified = verifyAccessToken(accessToken);
    if (verified.ok) {
      const remaining = verified.claims.exp - Math.floor(Date.now() / 1000);
      if (remaining > 0) await denylistJti(verified.claims.jti, remaining);
    }
  }

  if (allDevices && context.userId) {
    await bumpTokenVersion(context.userId);
    await revokeAllUserTokens(context.userId, 'logout_all_devices');
    authEventsTotal.inc({ event: 'logout_all' });
  } else if (refreshTokenRaw) {
    await revokeTokenByRaw(refreshTokenRaw, 'logout');
    authEventsTotal.inc({ event: 'logout' });
  }

  if (context.userId) {
    await recordAudit({
      actorId: context.userId,
      action: allDevices ? 'auth.logout_all' : 'auth.logout',
      entityType: 'user',
      entityId: context.userId,
      ip: context.ip,
    });
  }
}

// ── forgot / reset password ───────────────────────────────────────────

export async function forgotPassword(input: ForgotPasswordInput, context: { ip?: string }): Promise<void> {
  const user = await findUserByEmail(input.email);
  if (user) {
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await setResetToken(String(user._id), hashToken(raw), expiresAt);
    await sendMail({
      to: user.email,
      template: 'password_reset',
      subject: `Reset your ${env.APP_NAME} password`,
      vars: { name: user.name, url: `${env.APP_URL}/reset-password?token=${raw}` },
    });
    await recordAudit({
      actorId: String(user._id),
      action: 'auth.password_reset_requested',
      entityType: 'user',
      entityId: String(user._id),
      ip: context.ip,
    });
  } else {
    // Equalize timing with the user-found path (rough mail-cost parity).
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  log.debug('password reset requested');
}

export async function resetPassword(input: ResetPasswordInput, context: { ip?: string }): Promise<void> {
  const user = await findUserByTokenHash('resetTokenHash', 'resetTokenExpiresAt', hashToken(input.token));
  if (!user) {
    throw new ApiError('TOKEN_EXPIRED', 'Reset token is invalid or has expired', { status: 401 });
  }

  const policy = checkPasswordPolicy(input.password, { email: user.email, name: user.name });
  if (!policy.ok) {
    throw new ApiError('VALIDATION_ERROR', 'Password does not meet the policy', {
      status: 422,
      details: { issues: policy.reasons.map((message) => ({ path: 'password', message })) },
    });
  }

  const passwordHash = await hashPassword(input.password);
  await updatePasswordHash(String(user._id), passwordHash); // also bumps tokenVersion
  await revokeAllUserTokens(String(user._id), 'password_reset');
  await setResetToken(String(user._id), null, null);

  await recordAudit({
    actorId: String(user._id),
    action: 'auth.password_reset',
    entityType: 'user',
    entityId: String(user._id),
    ip: context.ip,
  });
  authEventsTotal.inc({ event: 'password_reset' });
}

// ── verify email ──────────────────────────────────────────────────────

export async function verifyEmail(token: string): Promise<{ email: string }> {
  const user = await findUserByTokenHash(
    'verificationTokenHash',
    'verificationTokenExpiresAt',
    hashToken(token),
  );
  if (!user) {
    throw new ApiError('TOKEN_EXPIRED', 'Verification token is invalid or has expired', { status: 401 });
  }
  await markEmailVerified(String(user._id));
  await recordAudit({
    actorId: String(user._id),
    action: 'auth.email_verified',
    entityType: 'user',
    entityId: String(user._id),
  });
  return { email: user.email };
}

// ── sessions ──────────────────────────────────────────────────────────

export async function getSessions(userId: string, currentRefreshRaw?: string): Promise<unknown[]> {
  const sessions = await listActiveSessions(userId);
  const currentHash = currentRefreshRaw ? hashToken(currentRefreshRaw) : null;
  return sessions.map((s) => ({
    id: s.familyId,
    device: s.device ?? 'unknown device',
    userAgent: s.userAgent ?? null,
    ip: s.ip ?? null,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    lastUsedAt: s.lastUsedAt ?? s.createdAt,
    current: currentHash !== null && s.tokenHash === currentHash,
  }));
}

export async function revokeSession(userId: string, familyId: string): Promise<void> {
  await revokeFamily(familyId, 'revoked_by_user');
  await recordAudit({
    actorId: userId,
    action: 'auth.session_revoked',
    entityType: 'user',
    entityId: userId,
    after: { familyId },
  });
}

// ── switch workspace (multi-tenant token scoping) ─────────────────────

export async function switchWorkspace(
  userId: string,
  workspaceId: string,
): Promise<{ accessToken: string; accessExpiresIn: number; workspaceId: string; role: string }> {
  const scope = await resolveWorkspaceScope(userId, workspaceId);
  const user = await findUserById(userId);
  if (!user) throw unauthenticated('Account no longer exists');
  const access = signAccessToken({
    userId,
    workspaceId: scope.workspaceId,
    role: scope.role,
    tokenVersion: user.tokenVersion,
  });
  await recordAudit({
    actorId: userId,
    action: 'auth.switch_workspace',
    entityType: 'workspace',
    entityId: workspaceId,
    workspaceId,
  });
  return {
    accessToken: access.token,
    accessExpiresIn: access.expiresInSeconds,
    workspaceId: scope.workspaceId!,
    role: scope.role!,
  };
}

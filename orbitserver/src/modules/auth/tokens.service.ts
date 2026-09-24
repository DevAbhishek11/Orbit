/**
 * Token service (BUILD_PROMPT Phase 3):
 *  - access: JWT HS256 {sub, wid, role, ver, jti, typ} with a 15-min TTL
 *  - refresh: opaque 64-byte random, stored SHA-256-hashed, rotated on use
 *  - reuse detection: presenting a rotated token revokes the WHOLE family
 *  - logout denylist: jti stored in Redis for the token's remaining life
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AUTH, CACHE } from '@orbit/shared';
import { env } from '../../config/env.js';
import { childLogger } from '../../infrastructure/logger/index.js';
import { getCacheClient } from '../../infrastructure/redis/cacheClient.js';
import { RefreshTokenModel, type IRefreshToken } from './refreshtokens.model.js';
import { bumpTokenVersion } from '../users/users.repository.js';

const log = childLogger({ module: 'tokens' });

export interface AccessTokenClaims {
  sub: string;
  wid?: string;
  role?: string;
  ver: number;
  jti: string;
  typ: 'access';
}

export function signAccessToken(input: {
  userId: string;
  workspaceId?: string;
  role?: string;
  tokenVersion: number;
}): { token: string; jti: string; expiresInSeconds: number } {
  const jti = randomUUID();
  const token = jwt.sign(
    {
      sub: input.userId,
      wid: input.workspaceId,
      role: input.role,
      ver: input.tokenVersion,
      typ: 'access' as const,
    },
    env.JWT_SECRET,
    {
      algorithm: env.JWT_ALGORITHM,
      expiresIn: env.ACCESS_TOKEN_TTL,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      jwtid: jti,
    },
  );
  return { token, jti, expiresInSeconds: env.ACCESS_TOKEN_TTL };
}

export type VerifyResult =
  | { ok: true; claims: AccessTokenClaims & { iat: number; exp: number } }
  | { ok: false; reason: 'expired' | 'invalid' };

export function verifyAccessToken(token: string): VerifyResult {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [env.JWT_ALGORITHM], // pins the algorithm — 'none' & RS/HS confusion rejected
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    if (typeof decoded === 'string') return { ok: false, reason: 'invalid' };
    const claims = decoded as unknown as AccessTokenClaims & { iat: number; exp: number };
    if (claims.typ !== 'access' || typeof claims.sub !== 'string' || typeof claims.ver !== 'number') {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, claims };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) return { ok: false, reason: 'expired' };
    return { ok: false, reason: 'invalid' };
  }
}

// ── jti denylist (logout) ─────────────────────────────────────────────

export async function denylistJti(jti: string, remainingSeconds: number): Promise<void> {
  const client = getCacheClient();
  if (!client) {
    // Fail-closed alternative: bump tokenVersion so ALL access tokens die.
    log.warn('redis-cache down during logout — denylist skipped (token remains valid ≤15 min)');
    return;
  }
  await client
    .set(`${CACHE.DENYLIST_PREFIX}${jti}`, '1', 'EX', Math.max(1, Math.ceil(remainingSeconds)))
    .catch((err: unknown) => log.error({ err }, 'denylist write failed'));
}

export async function isJtiDenylisted(jti: string): Promise<boolean> {
  const client = getCacheClient();
  if (!client) return false; // reads fail open here; authenticate still checks tokenVersion
  const value = await client.get(`${CACHE.DENYLIST_PREFIX}${jti}`).catch(() => null);
  return value !== null;
}

// ── Refresh tokens ────────────────────────────────────────────────────

export function generateRefreshTokenRaw(): string {
  return randomBytes(AUTH.REFRESH_TOKEN_BYTES).toString('base64url');
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export interface IssueRefreshResult {
  rawToken: string;
  familyId: string;
  expiresAt: Date;
}

export async function issueRefreshToken(input: {
  userId: string;
  familyId?: string;
  remember?: boolean;
  device?: string;
  userAgent?: string;
  ip?: string;
}): Promise<IssueRefreshResult> {
  const rawToken = generateRefreshTokenRaw();
  const ttlSeconds = input.remember ? env.REFRESH_TOKEN_TTL_REMEMBER : env.REFRESH_TOKEN_TTL;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const familyId = input.familyId ?? randomUUID();

  await RefreshTokenModel.create({
    userId: input.userId,
    tokenHash: hashRefreshToken(rawToken),
    familyId,
    device: input.device,
    userAgent: input.userAgent?.slice(0, 400),
    ip: input.ip,
    expiresAt,
  });
  return { rawToken, familyId, expiresAt };
}

export type RotateResult =
  | { ok: true; rawToken: string; record: IRefreshToken; familyId: string }
  | { ok: false; reason: 'not_found' | 'expired' | 'revoked' | 'reused' };

/**
 * Rotate a presented refresh token.
 * Reuse of an already-rotated token ⇒ REVOKE THE ENTIRE FAMILY (rule: token
 * theft is the only realistic way to replay a rotated token).
 */
export async function rotateRefreshToken(rawToken: string): Promise<RotateResult> {
  const tokenHash = hashRefreshToken(rawToken);
  const record = await RefreshTokenModel.findOne({ tokenHash }).exec();

  if (!record) return { ok: false, reason: 'not_found' };
  if (record.revokedAt) {
    return { ok: false, reason: 'revoked' };
  }
  if (record.rotatedAt) {
    // REUSE DETECTED — kill the family, force re-login everywhere in it.
    log.error(
      { userId: record.userId, familyId: record.familyId },
      'refresh token REUSE detected — revoking token family',
    );
    await revokeFamily(record.familyId, 'reuse_detected');
    await bumpTokenVersion(record.userId); // access tokens die too
    return { ok: false, reason: 'reused' };
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const remember =
    record.expiresAt.getTime() - record.createdAt.getTime() >
    env.REFRESH_TOKEN_TTL * 1000 + 60_000;
  const issued = await issueRefreshToken({
    userId: record.userId,
    familyId: record.familyId,
    remember,
    device: record.device,
    userAgent: record.userAgent,
    ip: record.ip,
  });

  // Mark rotation atomically — a concurrent double-refresh lets exactly one
  // caller win the findOneAndUpdate; the loser re-reads and sees rotatedAt set.
  const rotated = await RefreshTokenModel.findOneAndUpdate(
    { _id: record._id, rotatedAt: null, revokedAt: null },
    {
      $set: {
        rotatedAt: new Date(),
        replacedBy: hashRefreshToken(issued.rawToken),
        lastUsedAt: new Date(),
      },
    },
    { new: true },
  ).exec();

  if (!rotated) {
    // Lost the race — the winner already rotated; the issued token is orphaned.
    await RefreshTokenModel.deleteOne({ tokenHash: hashRefreshToken(issued.rawToken) }).exec();
    const current = await RefreshTokenModel.findOne({ tokenHash }).exec();
    if (current?.rotatedAt) return { ok: false, reason: 'reused' };
    return { ok: false, reason: 'revoked' };
  }

  return { ok: true, rawToken: issued.rawToken, record: rotated.toObject(), familyId: record.familyId };
}

export async function revokeFamily(familyId: string, reason: string): Promise<void> {
  await RefreshTokenModel.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  ).exec();
}

export async function revokeTokenByRaw(rawToken: string, reason: string): Promise<boolean> {
  const result = await RefreshTokenModel.updateOne(
    { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  ).exec();
  return result.modifiedCount > 0;
}

export async function revokeAllUserTokens(userId: string, reason: string): Promise<void> {
  await RefreshTokenModel.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  ).exec();
}

export async function listActiveSessions(userId: string): Promise<IRefreshToken[]> {
  return RefreshTokenModel.find({
    userId,
    revokedAt: null,
    rotatedAt: null, // only the CURRENT token of each family is an active session
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean<IRefreshToken[]>()
    .exec();
}

/** Constant-time compare helper for CSRF double-submit tokens. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

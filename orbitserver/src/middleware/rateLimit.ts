import type { RequestHandler } from 'express';
import type { RateLimitTier } from '@orbit/shared';
import { RATE_LIMIT_TIERS } from '@orbit/shared';
import { env } from '../config/env.js';
import { dependencyUnavailable, rateLimited } from '../infrastructure/errors/ApiError.js';
import { childLogger } from '../infrastructure/logger/index.js';
import { getCacheClient } from '../infrastructure/redis/cacheClient.js';
import { rateLimitHitsTotal } from '../infrastructure/metrics/index.js';

const log = childLogger({ module: 'rate-limit' });

const redisConfigured = Boolean(env.REDIS_CACHE_URL);
const warnedTiers = new Set<string>();

function warnNoLimiterOnce(tier: RateLimitTier): void {
  if (warnedTiers.has(tier)) return;
  warnedTiers.add(tier);
  log.warn(
    { tier },
    'REDIS_CACHE_URL is not set — rate limiting is DISABLED for this tier (fail-open). Set REDIS_CACHE_URL to enforce limits.',
  );
}

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = window - (now - tonumber(oldest[2]))
  if retry < 0 then retry = 0 end
  return { 0, tostring(count), tostring(retry) }
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return { 1, tostring(limit - count - 1), tostring(window) }
`;

export interface RateLimitOptions {
  tier: RateLimitTier;

  keyFor?: (req: Parameters<RequestHandler>[0]) => string;

  limit?: number;

  windowMs?: number;

  failClosed?: boolean;
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const tierCfg = RATE_LIMIT_TIERS[options.tier];
  const failClosed = options.failClosed ?? options.tier === 'auth';
  const limit = options.limit ?? tierCfg.limit;
  const windowMs = options.windowMs ?? tierCfg.windowMs;

  return async (req, _res, next) => {
    const client = getCacheClient();
    if (!client) {
      if (!redisConfigured && env.NODE_ENV !== 'production') {
        warnNoLimiterOnce(options.tier);
        next();
        return;
      }
      if (failClosed) {
        log.error({ tier: options.tier }, 'rate limiter fail-CLOSED: redis-cache unreachable');
        next(dependencyUnavailable('rate-limiter'));
        return;
      }
      log.warn({ tier: options.tier }, 'rate limiter fail-OPEN: redis-cache unreachable');
      next();
      return;
    }

    const identity = options.keyFor ? options.keyFor(req) : (req.ip ?? 'unknown-ip');
    const key = `rl:${options.tier}:${identity}`;
    const now = Date.now();
    const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;

    try {
      const result = (await client.eval(
        SLIDING_WINDOW_LUA,
        1,
        key,
        String(now),
        String(windowMs),
        String(limit),
        member,
      )) as [number, string, string];

      const [allowed, remainingOrCount, retryOrWindow] = result;
      if (allowed === 1) {
        _res.setHeader('RateLimit-Limit', String(limit));
        _res.setHeader('RateLimit-Remaining', remainingOrCount);
        _res.setHeader('RateLimit-Reset', Math.ceil(Number(retryOrWindow) / 1000));
        next();
        return;
      }

      rateLimitHitsTotal.inc({ tier: options.tier });
      const retryAfterSeconds = Math.max(1, Math.ceil(Number(retryOrWindow) / 1000));
      log.warn({ tier: options.tier, identity: key, retryAfterSeconds }, 'rate limit exceeded');
      next(rateLimited(retryAfterSeconds));
    } catch (err) {
      if (failClosed) {
        log.error({ err, tier: options.tier }, 'rate limiter error — fail-CLOSED');
        next(dependencyUnavailable('rate-limiter'));
        return;
      }
      log.warn(
        { err: (err as Error).message, tier: options.tier },
        'rate limiter error — fail-OPEN',
      );
      next();
    }
  };
}

export function authKeyFor(req: Parameters<RequestHandler>[0]): string {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.toLowerCase() : 'no-email';
  return `${req.ip ?? 'unknown-ip'}|${email}`;
}

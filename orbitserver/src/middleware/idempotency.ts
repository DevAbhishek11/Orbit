import type { RequestHandler } from 'express';
import { CACHE } from '@orbit/shared';
import { lockBusy } from '../infrastructure/errors/ApiError.js';
import { childLogger } from '../infrastructure/logger/index.js';
import { getCacheClient } from '../infrastructure/redis/cacheClient.js';

const log = childLogger({ module: 'idempotency' });

const IN_FLIGHT = '__in_flight__';
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function idempotency(): RequestHandler {
  return async (req, res, next) => {
    if (req.method !== 'POST') {
      next();
      return;
    }
    const header = req.header('idempotency-key');
    if (!header) {
      next();
      return;
    }
    if (!KEY_PATTERN.test(header)) {
      next(lockBusy('Idempotency-Key must be 8-128 chars of [A-Za-z0-9_-]'));
      return;
    }

    const client = getCacheClient();
    if (!client) {
      log.warn('idempotency skipped — redis-cache unreachable');
      next();
      return;
    }

    const identity = req.auth?.userId ?? req.ip ?? 'anonymous';
    const cacheKey = `idem:${identity}:${req.path}:${header}`;
    const ttl = CACHE.IDEMPOTENCY_TTL_SECONDS;

    try {
      const won = await client.set(cacheKey, IN_FLIGHT, 'EX', ttl, 'NX');
      if (won === 'OK') {
        const originalJson = res.json.bind(res);
        res.json = ((body: unknown) => {
          const payload = JSON.stringify({ status: res.statusCode, body });
          client
            .set(cacheKey, payload, 'EX', ttl)
            .catch((err: unknown) => log.error({ err }, 'failed to store idempotent response'));
          return originalJson(body);
        }) as typeof res.json;

        res.on('close', () => {
          if (!res.writableEnded) {
            client.del(cacheKey).catch(() => undefined);
          }
        });
        next();
        return;
      }

      const stored = await client.get(cacheKey);
      if (stored && stored !== IN_FLIGHT) {
        const { status, body } = JSON.parse(stored) as { status: number; body: unknown };
        res.setHeader('Idempotency-Replay', 'true');
        res.status(status).json(body);
        return;
      }

      res.setHeader('Retry-After', '2');
      next(lockBusy('A request with this Idempotency-Key is still in progress'));
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'idempotency error — proceeding without it');
      next();
    }
  };
}

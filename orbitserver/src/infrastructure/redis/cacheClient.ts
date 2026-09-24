/**
 * redis-cache client (BUILD_PROMPT rule 5): cache / pubsub / presence /
 * rate-limit / idempotency. allkeys-lru eviction; NEVER used by BullMQ.
 *
 * Failure posture (failure mode #3): offline queue disabled, one retry per
 * command, capped backoff + jitter — callers must handle `null` (cache miss)
 * and fall back to Mongo. Losing Redis degrades latency, never correctness.
 */
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { childLogger } from '../logger/index.js';

const log = childLogger({ module: 'redis-cache' });

let client: Redis | null = null;
let healthy = false;

export function createCacheClient(): Redis {
  if (client) return client;
  if (!env.REDIS_CACHE_URL) {
    log.warn('REDIS_CACHE_URL not set — cache layer disabled (Mongo-only reads)');
    throw new Error('cache client unavailable');
  }

  client = new Redis(env.REDIS_CACHE_URL, {
    keyPrefix: `${env.REDIS_KEY_PREFIX}:`,
    lazyConnect: true,
    enableOfflineQueue: false, // fail fast → callers fall back to Mongo
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(50 * 2 ** Math.min(times, 8), 5_000) + Math.random() * 100,
    reconnectOnError: (err) => err.message.includes('READONLY'),
    connectTimeout: 5_000,
    enableReadyCheck: true,
  });

  client.on('connect', () => log.debug('redis-cache connected'));
  client.on('ready', () => {
    healthy = true;
    log.info('redis-cache ready');
  });
  client.on('error', (err: Error) => {
    healthy = false;
    log.error({ err: err.message }, 'redis-cache error');
  });
  client.on('close', () => {
    healthy = false;
    log.warn('redis-cache connection closed');
  });

  return client;
}

export function getCacheClient(): Redis | null {
  return healthy ? client : null;
}

export function isCacheHealthy(): boolean {
  return healthy;
}

export async function pingCache(): Promise<boolean> {
  if (!client) return false;
  try {
    return (await client.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export async function closeCacheClient(): Promise<void> {
  if (!client) return;
  healthy = false;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
  client = null;
}

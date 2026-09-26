import { childLogger } from '../logger/index.js';
import { getCacheClient } from '../redis/cacheClient.js';
import { cacheOpsTotal, cacheSetsTotal } from '../metrics/index.js';
import { env } from '../../config/env.js';

const log = childLogger({ module: 'cache' });

interface CacheRecord<T> {
  v: T;

  exp: number;

  swr: number;

  tags: string[];
}

export interface GetOrSetOptions {
  ttlSeconds?: number;

  swrSeconds?: number;
  tags?: string[];

  lockTtlSeconds?: number;
}

function fullKey(key: string): string {
  return `c:${key}`;
}

function tagKey(tag: string): string {
  return `tag:${tag}`;
}

export async function cacheGet<T>(key: string): Promise<{ value: T; stale: boolean } | null> {
  if (!env.CACHE_ENABLED) return null;
  const client = getCacheClient();
  if (!client) return null;
  try {
    const raw = await client.get(fullKey(key));
    if (!raw) {
      cacheOpsTotal.inc({ result: 'miss' });
      return null;
    }
    const record = JSON.parse(raw) as CacheRecord<T>;
    const now = Date.now();
    if (now > record.swr) {
      cacheOpsTotal.inc({ result: 'miss' });
      return null;
    }
    cacheOpsTotal.inc({ result: 'hit' });
    return { value: record.v, stale: now > record.exp };
  } catch (err) {
    cacheOpsTotal.inc({ result: 'error' });
    log.warn({ err: (err as Error).message, key }, 'cache get failed — treating as miss');
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  options: GetOrSetOptions = {},
): Promise<void> {
  if (!env.CACHE_ENABLED) return;
  const client = getCacheClient();
  if (!client) return;
  const ttl = options.ttlSeconds ?? env.REDIS_CACHE_TTL_DEFAULT;
  const swr = options.swrSeconds ?? 0;
  const now = Date.now();
  const record: CacheRecord<T> = {
    v: value,
    exp: now + ttl * 1000,
    swr: now + (ttl + swr) * 1000,
    tags: options.tags ?? [],
  };
  try {
    const pipeline = client.pipeline();
    pipeline.set(fullKey(key), JSON.stringify(record), 'EX', ttl + swr);
    for (const tag of options.tags ?? []) {
      pipeline.sadd(tagKey(tag), key);
      pipeline.expire(tagKey(tag), ttl + swr + 60);
    }
    await pipeline.exec();
    cacheSetsTotal.inc({ op: 'set' });
  } catch (err) {
    log.warn({ err: (err as Error).message, key }, 'cache set failed');
  }
}

export async function cacheDel(key: string): Promise<void> {
  const client = getCacheClient();
  if (!client) return;
  try {
    await client.del(fullKey(key));
    cacheSetsTotal.inc({ op: 'invalidate' });
  } catch (err) {
    log.warn({ err: (err as Error).message, key }, 'cache del failed');
  }
}

export async function invalidateTag(tag: string): Promise<void> {
  const client = getCacheClient();
  if (!client) return;
  try {
    const keys = await client.smembers(tagKey(tag));
    if (keys.length === 0) return;
    const pipeline = client.pipeline();
    for (const key of keys) pipeline.del(fullKey(key));
    pipeline.del(tagKey(tag));
    await pipeline.exec();
    cacheSetsTotal.inc({ op: 'invalidate' });
    log.debug({ tag, count: keys.length }, 'cache tag invalidated');
  } catch (err) {
    log.warn({ err: (err as Error).message, tag }, 'tag invalidation failed');
  }
}

export async function getOrSet<T>(
  key: string,
  loader: () => Promise<T>,
  options: GetOrSetOptions = {},
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit && !hit.stale) return hit.value;
  if (hit && hit.stale) {
    void refreshInBackground(key, loader, options);
    return hit.value;
  }

  const client = getCacheClient();
  if (!client) return loader();

  const lockKey = `lock:${key}`;
  const lockTtl = options.lockTtlSeconds ?? 10;
  for (let attempt = 0; attempt < 3; attempt++) {
    const won = await client.set(lockKey, '1', 'EX', lockTtl, 'NX').catch(() => null);
    if (won === 'OK') {
      try {
        const value = await loader();
        await cacheSet(key, value, options);
        return value;
      } finally {
        await client.del(lockKey).catch(() => undefined);
      }
    }

    await sleep(50 * (attempt + 1));
    const retried = await cacheGet<T>(key);
    if (retried) return retried.value;
  }

  const value = await loader();
  await cacheSet(key, value, options);
  return value;
}

let refreshing = new Set<string>();

async function refreshInBackground<T>(
  key: string,
  loader: () => Promise<T>,
  options: GetOrSetOptions,
): Promise<void> {
  if (refreshing.has(key)) return;
  refreshing.add(key);
  try {
    const value = await loader();
    await cacheSet(key, value, options);
  } catch (err) {
    log.warn({ err: (err as Error).message, key }, 'background refresh failed — stale entry kept');
  } finally {
    refreshing.delete(key);
  }
}

export function __resetCacheInternals(): void {
  refreshing = new Set();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * redis-queue client (BUILD_PROMPT rule 5): BullMQ + locks ONLY.
 * noeviction + AOF instance. maxRetriesPerRequest must stay null (BullMQ
 * blocking commands require unlimited retries per request).
 */
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { childLogger } from '../logger/index.js';

const log = childLogger({ module: 'redis-queue' });

let client: Redis | null = null;
let healthy = false;

export function createQueueClient(): Redis {
  if (client) return client;
  if (!env.REDIS_QUEUE_URL) {
    log.warn('REDIS_QUEUE_URL not set — queue layer disabled (QUEUE_DISABLED semantics)');
    throw new Error('queue client unavailable');
  }

  client = new Redis(env.REDIS_QUEUE_URL, {
    keyPrefix: `${env.REDIS_KEY_PREFIX}:`,
    lazyConnect: true,
    enableOfflineQueue: true, // queue writes buffer briefly during blips
    maxRetriesPerRequest: null, // required by BullMQ
    retryStrategy: (times) => Math.min(100 * 2 ** Math.min(times, 8), 10_000) + Math.random() * 200,
    connectTimeout: 5_000,
  });

  client.on('ready', () => {
    healthy = true;
    log.info('redis-queue ready');
  });
  client.on('error', (err: Error) => {
    healthy = false;
    log.error({ err: err.message }, 'redis-queue error');
  });
  client.on('close', () => {
    healthy = false;
    log.warn('redis-queue connection closed');
  });

  return client;
}

export function getQueueClient(): Redis | null {
  return healthy ? client : null;
}

export function isQueueRedisHealthy(): boolean {
  return healthy;
}

export async function pingQueueRedis(): Promise<boolean> {
  if (!client) return false;
  try {
    return (await client.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export async function closeQueueClient(): Promise<void> {
  if (!client) return;
  healthy = false;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
  client = null;
}

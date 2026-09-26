import mongoose from 'mongoose';
import { getDbRuntimeInfo } from '../../infrastructure/db/mongoose.js';
import { pingCache } from '../../infrastructure/redis/cacheClient.js';
import { pingQueueRedis } from '../../infrastructure/redis/queueClient.js';
import { env } from '../../config/env.js';
import { startedAt, uptimeSeconds } from '../../infrastructure/runtime/bootInfo.js';

export type DependencyStatus = 'up' | 'down' | 'disabled';

export interface HealthReport {
  status: 'ok' | 'degraded' | 'unavailable';
  uptimeSeconds: number;
  startedAt: string;
  version: string;
  dependencies: {
    mongo: DependencyStatus;
    redisCache: DependencyStatus;
    redisQueue: DependencyStatus;
  };
  runtime?: {
    topology: string;
    transactionsSupported: boolean;
    mongoServerVersion: string;
    dbName: string;
    node: string;
    memoryRssMb: number;
  };
}

async function pingMongo(): Promise<boolean> {
  try {
    if (Number(mongoose.connection.readyState) !== 1) return false;
    await mongoose.connection.db?.admin().ping();
    return true;
  } catch {
    return false;
  }
}

export async function buildReadyReport(): Promise<{ status: number; report: HealthReport }> {
  const [mongoUp, cacheUp, queueUp] = await Promise.all([
    pingMongo(),
    env.REDIS_CACHE_URL ? pingCache() : Promise.resolve(false),
    env.REDIS_QUEUE_URL ? pingQueueRedis() : Promise.resolve(false),
  ]);

  const redisStatus = (configured: boolean, up: boolean): DependencyStatus =>
    !configured ? 'disabled' : up ? 'up' : 'down';
  const dependencies: HealthReport['dependencies'] = {
    mongo: mongoUp ? 'up' : 'down',
    redisCache: redisStatus(Boolean(env.REDIS_CACHE_URL), cacheUp),
    redisQueue: redisStatus(Boolean(env.REDIS_QUEUE_URL), queueUp),
  };

  const status: HealthReport['status'] = !mongoUp
    ? 'unavailable'
    : dependencies.redisCache === 'down' || dependencies.redisQueue === 'down'
      ? 'degraded'
      : 'ok';

  const report: HealthReport = {
    status,
    uptimeSeconds: uptimeSeconds(),
    startedAt,
    version: env.APP_VERSION,
    dependencies,
  };
  if (env.HEALTH_DETAILED) {
    const info = getDbRuntimeInfo();
    report.runtime = {
      topology: info.topology,
      transactionsSupported: info.transactionsSupported,
      mongoServerVersion: info.serverVersion,
      dbName: info.dbName,
      node: process.version,
      memoryRssMb: Math.round(process.memoryUsage.rss() / 1024 / 1024),
    };
  }
  return { status: status === 'unavailable' ? 503 : 200, report };
}

export function buildLiveReport(): {
  status: number;
  report: { status: 'ok'; uptimeSeconds: number };
} {
  return { status: 200, report: { status: 'ok', uptimeSeconds: uptimeSeconds() } };
}

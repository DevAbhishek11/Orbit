/**
 * Server bootstrap (BUILD_PROMPT Phase 2):
 *   env → logger → mongo → redis → app → listen(0.0.0.0)
 * Graceful shutdown drains HTTP → Mongo → Redis on SIGTERM/SIGINT with a hard
 * deadline; unhandled rejections/exceptions log fatal and exit non-zero.
 *
 * Resilient boot: if MongoDB is unreachable the server still starts and
 * /health/ready reports 503 (so orchestrators and previews see the truth),
 * unless MONGO_REQUIRE_TRANSACTIONS=true (strict mode → exit).
 */
import http from 'node:http';
import { env } from './config/env.js';
import { logger } from './infrastructure/logger/index.js';
import { connectDatabase, disconnectDatabase } from './infrastructure/db/mongoose.js';
import { createCacheClient, closeCacheClient } from './infrastructure/redis/cacheClient.js';
import { createQueueClient, closeQueueClient } from './infrastructure/redis/queueClient.js';
import { startMetricsCollectors, stopMetricsCollectors } from './infrastructure/metrics/index.js';
import { createApp } from './app.js';

const SHUTDOWN_DEADLINE_MS = 15_000;

async function boot(): Promise<void> {
  logger.info(
    { env: env.NODE_ENV, port: env.PORT, version: env.APP_VERSION },
    `starting ${env.APP_NAME} API`,
  );

  // ── MongoDB (Atlas) ──────────────────────────────────────────────
  try {
    await connectDatabase();
  } catch (err) {
    logger.fatal({ err: (err as Error).message }, 'MongoDB unreachable at boot');
    if (env.MONGO_REQUIRE_TRANSACTIONS) {
      logger.fatal('MONGO_REQUIRE_TRANSACTIONS=true — refusing to serve without the database');
      process.exit(1);
    }
    logger.warn('continuing in DEGRADED mode — /health/ready will report 503 until Mongo recovers');
  }

  // ── Redis (best-effort: cache/queue degrade gracefully) ──────────
  try {
    const cache = createCacheClient();
    await cache.connect();
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'redis-cache unavailable — running without cache');
  }
  if (!env.QUEUE_DISABLED && env.REDIS_QUEUE_URL) {
    try {
      const queue = createQueueClient();
      await queue.connect();
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'redis-queue unavailable — jobs run inline');
    }
  }

  // ── HTTP ──────────────────────────────────────────────────────────
  const app = createApp();
  const server = http.createServer(app);
  server.headersTimeout = 65_000; // > keep-alive proxies
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 60_000;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.PORT, '0.0.0.0', resolve);
  });

  startMetricsCollectors();
  logger.info({ port: env.PORT, url: `http://0.0.0.0:${env.PORT}` }, 'orbit-api is listening');
  process.send?.({ type: 'ready' });

  installShutdownHandlers(server);
}

function installShutdownHandlers(server: http.Server): void {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'graceful shutdown started');

    const hardDeadline = setTimeout(() => {
      logger.fatal('shutdown deadline exceeded — forcing exit');
      process.exit(1);
    }, SHUTDOWN_DEADLINE_MS);
    hardDeadline.unref();

    // 1. Stop accepting connections; let in-flight requests drain.
    await new Promise<void>((resolve) => server.close(() => resolve()));
    // 2. Data stores in dependency order.
    stopMetricsCollectors();
    await closeCacheClient().catch(() => undefined);
    await closeQueueClient().catch(() => undefined);
    await disconnectDatabase().catch(() => undefined);

    logger.info('shutdown complete');
    clearTimeout(hardDeadline);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandled promise rejection');
    void shutdown('unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception');
    void shutdown('uncaughtException');
  });
}

boot().catch((err: unknown) => {
  logger.fatal({ err }, 'boot failed');
  process.exit(1);
});

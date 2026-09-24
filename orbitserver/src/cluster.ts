/**
 * Clustered server runtime (PROJECT_PLAN §6.5 & BUILD_PROMPT Phase 2):
 *
 * Primary process:
 *  - forks WEB_CONCURRENCY workers (defaults to os.availableParallelism() in prod, 1 in dev)
 *  - staggers startup (750 ms) so DB/Redis pools warm up gently
 *  - monitors worker liveness & auto-restarts crashed workers with exponential backoff
 *  - detects crash loops (>10 rapid crashes in 60 s) and exits so orchestrator intervenes
 *  - zero-downtime rolling reload on SIGUSR2 (drains one worker, forks new, staggers)
 *  - orchestrated graceful shutdown on SIGTERM / SIGINT
 *
 * Worker process:
 *  - loads and executes server.ts
 */
import cluster from 'node:cluster';
import os from 'node:os';
import process from 'node:process';
import { env, isProd } from './config/env.js';
import { logger } from './infrastructure/logger/index.js';

const SHUTDOWN_GRACE_MS = 15_000;

if (cluster.isPrimary) {
  const concurrencyFromEnv = env.WEB_CONCURRENCY;
  const workerCount = Math.max(
    1,
    concurrencyFromEnv && concurrencyFromEnv > 0
      ? concurrencyFromEnv
      : isProd
        ? os.availableParallelism()
        : 1,
  );

  logger.info(
    { workers: workerCount, pid: process.pid, env: env.NODE_ENV },
    'cluster primary: initializing supervisor',
  );

  const bootTime = Date.now();
  let shuttingDown = false;

  const fork = (workerIndex: number) => {
    if (shuttingDown) return;
    const worker = cluster.fork({ WORKER_INDEX: String(workerIndex) });

    worker.on('message', (msg: unknown) => {
      if (typeof msg === 'object' && msg !== null && (msg as { type?: string }).type === 'ready') {
        logger.info(
          { workerPid: worker.process.pid, workerId: worker.id, bootElapsedMs: Date.now() - bootTime },
          'cluster worker ready to accept requests',
        );
      }
    });

    return worker;
  };

  // 1) Fork workers with staggered start
  for (let i = 0; i < workerCount; i++) {
    setTimeout(() => fork(i), i * 750);
  }

  // 2) Crash resilience: auto-restart with exponential backoff & crash-loop detection
  const crashes = new Map<number, { count: number; lastAt: number }>();
  cluster.on('exit', (worker, code, signal) => {
    if (shuttingDown) return;

    const workerId = worker.id;
    const rec = crashes.get(workerId) ?? { count: 0, lastAt: 0 };
    const now = Date.now();

    rec.count = now - rec.lastAt < 60_000 ? rec.count + 1 : 1;
    rec.lastAt = now;
    crashes.set(workerId, rec);

    const delayMs = Math.min(2 ** rec.count * 250, 30_000);
    logger.error(
      {
        workerPid: worker.process.pid,
        workerId,
        code,
        signal,
        crashCount: rec.count,
        restartInMs: delayMs,
      },
      'cluster worker exited unexpectedly — auto-restarting worker',
    );

    if (rec.count > 10) {
      logger.fatal(
        { workerId, crashCount: rec.count },
        'worker crash-loop detected (>10 crashes in 60 s) — exiting primary for orchestrator recovery',
      );
      process.exit(1);
    }

    setTimeout(() => {
      if (!shuttingDown) fork(workerId);
    }, delayMs);
  });

  // 3) Zero-downtime rolling reload on SIGUSR2
  async function rollingReload(): Promise<void> {
    if (shuttingDown) return;
    logger.info('cluster primary: starting zero-downtime rolling reload (SIGUSR2)');

    const workerIds = Object.keys(cluster.workers ?? {}).map(Number);
    for (const id of workerIds) {
      const w = cluster.workers?.[id];
      if (!w) continue;

      await new Promise<void>((resolve) => {
        const killTimer = setTimeout(() => {
          try {
            w.process.kill('SIGKILL');
          } catch {
            // Already dead
          }
          resolve();
        }, SHUTDOWN_GRACE_MS);
        killTimer.unref();

        w.once('exit', () => {
          clearTimeout(killTimer);
          resolve();
        });

        try {
          w.send({ type: 'graceful-shutdown' });
        } catch {
          w.kill('SIGTERM');
        }
      });

      fork(id);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    logger.info('cluster primary: rolling reload complete');
  }

  process.on('SIGUSR2', () => void rollingReload());

  // 4) Orchestrated shutdown (SIGTERM / SIGINT)
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'cluster primary: draining all workers');

    const workers = Object.values(cluster.workers ?? {}).filter(Boolean);
    await Promise.all(
      workers.map(
        (w) =>
          new Promise<void>((resolve) => {
            const killTimer = setTimeout(() => {
              try {
                w?.kill('SIGKILL');
              } catch {
                // Ignore
              }
              resolve();
            }, SHUTDOWN_GRACE_MS);
            killTimer.unref();

            w?.once('exit', () => {
              clearTimeout(killTimer);
              resolve();
            });

            try {
              w?.send({ type: 'graceful-shutdown' });
            } catch {
              w?.kill('SIGTERM');
            }
          }),
      ),
    );

    logger.info('cluster primary: all workers stopped, exiting cleanly');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
} else {
  // Cluster worker: launch the HTTP server
  await import('./server.js');
}

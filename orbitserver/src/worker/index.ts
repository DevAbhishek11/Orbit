/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-assignment */
/**
 * BullMQ Worker service (BUILD_PROMPT Phase 10):
 * One Worker per queue with own concurrency, lockDuration, stalled handling,
 * DLQ routing, and repeatable jobs registered ONLY here (never in API).
 */
import { Worker, type Job } from 'bullmq';
import { logger } from '../infrastructure/logger/index.js';
import { createQueueClient, getQueueClient } from '../infrastructure/redis/queueClient.js';
import { connectDatabase } from '../infrastructure/db/mongoose.js';
import { QueueNames, type QueueName, getBullQueue } from '../infrastructure/queues/index.js';

const log = logger.child({ module: 'worker' });

type Processor = (job: Job) => Promise<void>;

const processors: Record<string, Processor> = {
  'mail:send-verification': async (job) => {
    log.info({ to: (job.data as any).email }, 'mail: send verification (stub)');
  },
  'mail:send-invite': async (job) => {
    log.info({ to: (job.data as any).email }, 'mail: send invite (stub)');
  },
  'mail:send-reset': async (job) => {
    log.info({ to: (job.data as any).email }, 'mail: send password reset (stub)');
  },
  'notifications:fan-out': async (job) => {
    log.debug({ type: (job.data as any).type, workspaceId: (job.data as any).workspaceId }, 'notifications fan-out');
  },
  'search-index:reindex-entity': async (job) => {
    log.debug({ entityType: (job.data as any).entityType, entityId: (job.data as any).entityId }, 'search reindex');
  },
  'search-index:reindex-workspace': async (job) => {
    log.info({ workspaceId: (job.data as any).workspaceId }, 'workspace full reindex started');
  },
  'files:process-upload': async (job) => {
    log.debug({ fileId: (job.data as any).fileId }, 'files processing upload');
  },
  'analytics:daily-rollup': async (job) => {
    log.info({ date: (job.data as any).date }, 'analytics daily rollup');
  },
  'analytics:reconcile-counters': async () => {
    log.info('analytics counter reconciliation');
  },
  'cleanup:purge-trash': async () => {
    log.info('cleanup: purging trash older than 30 days');
  },
  'cleanup:purge-expired': async () => {
    log.info('cleanup: purging expired tokens/invites');
  },
  'pages:snapshot-dirty': async () => {
    log.debug('pages: snapshotting dirty pages');
  },
  'reminders:due-soon': async () => {
    log.debug('reminders: checking due soon cards');
  },
  'webhooks:deliver': async (job) => {
    log.debug({ url: (job.data as any).url }, 'webhook delivery');
  },
  'cleanup:rebalance-order-keys': async () => {
    log.info('cleanup: rebalancing fractional order keys');
  },
};

const concurrencyMap: Record<QueueName, number> = {
  mail: 5,
  notifications: 10,
  'search-index': 4,
  files: 3,
  analytics: 1,
  cleanup: 1,
  pages: 2,
  reminders: 1,
  webhooks: 5,
  dlq: 1,
};

function createWorker(queueName: QueueName): Worker | null {
  const connection = getQueueClient();
  if (!connection) {
    log.warn({ queue: queueName }, 'queue redis unavailable — worker not started');
    return null;
  }

  const concurrency = concurrencyMap[queueName] ?? 2;

  const worker = new Worker(
    queueName,
    async (job: Job) => {
      const key = `${queueName}:${job.name}`;
      const processor = processors[key] ?? processors[job.name];
      if (!processor) {
        log.warn({ queue: queueName, jobName: job.name }, 'no processor registered — skipping');
        return;
      }
      log.debug({ queue: queueName, jobName: job.name, jobId: job.id }, 'processing job');
      await processor(job);
    },
    {
      connection,
      concurrency,
      lockDuration: 60_000,
      stalledInterval: 30_000,
      maxStalledCount: 2,
      limiter:
        queueName === 'mail'
          ? { max: 50, duration: 60_000 }
          : undefined,
    },
  );

  worker.on('completed', (job) => {
    log.debug({ queue: queueName, jobId: job.id, jobName: job.name }, 'job completed');
  });

  worker.on('failed', (job, err) => {
    void (async () => {
      log.error({ queue: queueName, jobId: job?.id, jobName: job?.name, err: err.message }, 'job failed');
      if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
        try {
          const dlqQueue = getBullQueue('dlq');
          if (dlqQueue) {
            await dlqQueue.add(
              `dlq:${queueName}:${job.name}`,
              {
                originalQueue: queueName,
                originalJobName: job.name,
                originalData: job.data,
                failedReason: err.message,
                failedAt: new Date().toISOString(),
              },
              { attempts: 3 },
            );
            log.warn({ queue: queueName, jobId: job.id }, 'job routed to DLQ');
          }
        } catch (dlqErr) {
          log.error({ err: (dlqErr as Error).message }, 'failed to route job to DLQ');
        }
      }
    })();
  });

  worker.on('stalled', (jobId) => {
    log.warn({ queue: queueName, jobId }, 'job stalled');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message, queue: queueName }, 'worker error');
  });

  log.info({ queue: queueName, concurrency }, 'bullmq worker started');
  return worker;
}

async function registerRepeatableJobs(): Promise<void> {
  const connection = getQueueClient();
  if (!connection) return;

  const { Queue } = await import('bullmq');

  const pagesQueue = new Queue('pages', { connection });
  await pagesQueue.add('snapshot-dirty', {}, { repeat: { pattern: '*/5 * * * *' }, jobId: 'repeat:snapshot-dirty' });

  const cleanupQueue = new Queue('cleanup', { connection });
  await cleanupQueue.add('purge-trash', {}, { repeat: { pattern: '0 3 * * *' }, jobId: 'repeat:purge-trash' });
  await cleanupQueue.add('purge-expired', {}, { repeat: { pattern: '0 3 * * *' }, jobId: 'repeat:purge-expired' });
  await cleanupQueue.add('rebalance-order-keys', {}, { repeat: { pattern: '0 4 * * 0' }, jobId: 'repeat:rebalance-order-keys' });

  const analyticsQueue = new Queue('analytics', { connection });
  await analyticsQueue.add('daily-rollup', { date: new Date().toISOString().slice(0, 10) }, { repeat: { pattern: '15 1 * * *' }, jobId: 'repeat:daily-rollup' });
  await analyticsQueue.add('reconcile-counters', {}, { repeat: { pattern: '30 3 * * 0' }, jobId: 'repeat:reconcile-counters' });

  const remindersQueue = new Queue('reminders', { connection });
  await remindersQueue.add('due-soon', {}, { repeat: { pattern: '0 * * * *' }, jobId: 'repeat:due-soon' });

  log.info('repeatable jobs registered');
}

async function boot(): Promise<void> {
  log.info('starting orbit worker service');

  try {
    await connectDatabase();
    log.info('worker: database connected');
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'worker: database unavailable — some jobs may fail');
  }

  try {
    const client = createQueueClient();
    await client.connect();
    log.info('worker: redis-queue connected');
  } catch (err) {
    log.fatal({ err: (err as Error).message }, 'worker: redis-queue unavailable — cannot start workers');
    process.exit(1);
  }

  const workers: Worker[] = [];
  for (const queueName of QueueNames) {
    if (queueName === 'dlq') continue;
    const worker = createWorker(queueName as QueueName);
    if (worker) workers.push(worker);
  }

  await registerRepeatableJobs();

  log.info({ workers: workers.length }, 'orbit worker service ready');

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'worker shutdown started');
    for (const w of workers) {
      try {
        await w.close();
      } catch {
        // ignore
      }
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    log.fatal({ err: reason }, 'worker unhandled rejection');
    void shutdown('unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'worker uncaught exception');
    void shutdown('uncaughtException');
  });
}

boot().catch((err) => {
  log.fatal({ err }, 'worker boot failed');
  process.exit(1);
});

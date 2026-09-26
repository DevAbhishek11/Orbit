import crypto from 'node:crypto';
import { Queue, type JobsOptions } from 'bullmq';
import { childLogger } from '../logger/index.js';
import { env } from '../../config/env.js';
import { getQueueClient } from '../redis/queueClient.js';

const log = childLogger({ module: 'queues' });

export const QueueNames = [
  'mail',
  'notifications',
  'search-index',
  'files',
  'analytics',
  'cleanup',
  'pages',
  'reminders',
  'webhooks',
  'dlq',
] as const;

export type QueueName = (typeof QueueNames)[number];

type JobHandler = (data: Record<string, unknown>) => Promise<void>;
const inlineHandlers = new Map<string, JobHandler>();

export function registerInlineHandler(queue: QueueName, name: string, handler: JobHandler): void {
  inlineHandlers.set(`${queue}:${name}`, handler);
}

export interface EnqueueOptions {
  dedupeKey?: string;
  delayMs?: number;
  jobId?: string;
}

const bullQueues = new Map<QueueName, Queue>();

function getOrCreateBullQueue(name: QueueName): Queue | null {
  const existing = bullQueues.get(name);
  if (existing) return existing;

  const connection = getQueueClient();
  if (!connection) {
    log.warn({ queue: name }, 'queue redis unavailable — job buffered inline');
    return null;
  }

  const queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });

  queue.on('error', (err: Error) => {
    log.error({ err: err.message, queue: name }, 'bullmq queue error');
  });

  bullQueues.set(name, queue);
  return queue;
}

function buildJobId(dedupeKey?: string): string | undefined {
  if (!dedupeKey) return undefined;
  return crypto.createHash('sha256').update(dedupeKey).digest('hex').slice(0, 32);
}

export async function enqueue(
  queue: QueueName,
  name: string,
  data: Record<string, unknown>,
  options: EnqueueOptions = {},
): Promise<void> {
  if (env.QUEUE_DISABLED) {
    const handler = inlineHandlers.get(`${queue}:${name}`);
    if (handler) {
      try {
        await handler(data);
      } catch (err) {
        log.error({ err, queue, name }, 'inline job handler failed');
      }
    } else {
      log.debug(
        { queue, name, data, dedupeKey: options.dedupeKey },
        'job enqueued (inline stub — no handler)',
      );
    }
    return;
  }

  try {
    const bullQueue = getOrCreateBullQueue(queue);
    if (!bullQueue) {
      const handler = inlineHandlers.get(`${queue}:${name}`);
      if (handler) {
        await handler(data).catch((err) => {
          log.error({ err, queue, name }, 'inline fallback handler failed');
        });
      }
      return;
    }

    const jobId = options.jobId ?? buildJobId(options.dedupeKey);
    const jobOptions: JobsOptions = {};
    if (jobId) jobOptions.jobId = jobId;
    if (options.delayMs) jobOptions.delay = options.delayMs;

    await bullQueue.add(name, data, jobOptions);
    log.debug({ queue, name, jobId }, 'job enqueued to bullmq');
  } catch (err) {
    log.error(
      { err: (err as Error).message, queue, name },
      'failed to enqueue job — swallowed to protect request path',
    );
  }
}

export async function enqueueOnce(
  queue: QueueName,
  name: string,
  data: Record<string, unknown>,
  dedupeKey: string,
): Promise<void> {
  return enqueue(queue, name, data, { dedupeKey });
}

export async function closeAllQueues(): Promise<void> {
  for (const [name, queue] of bullQueues.entries()) {
    try {
      await queue.close();
      log.info({ queue: name }, 'bullmq queue closed');
    } catch {}
  }
  bullQueues.clear();
}

export function getBullQueue(name: QueueName): Queue | undefined {
  return bullQueues.get(name);
}

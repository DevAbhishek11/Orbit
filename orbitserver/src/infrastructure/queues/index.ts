/**
 * Queue facade (BUILD_PROMPT Phase 10 seam).
 *
 * With QUEUE_DISABLED=true (dev/test default) jobs are logged and executed by
 * registered in-process handlers — the API surface stays identical, so wiring
 * BullMQ later changes only this file. Payloads carry IDs, never documents.
 */
import { childLogger } from '../logger/index.js';
import { env } from '../../config/env.js';

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
] as const;

export type QueueName = (typeof QueueNames)[number];

type JobHandler = (data: Record<string, unknown>) => Promise<void>;
const inlineHandlers = new Map<string, JobHandler>();

/** Register an in-process handler (used when QUEUE_DISABLED=true, and by tests). */
export function registerInlineHandler(queue: QueueName, name: string, handler: JobHandler): void {
  inlineHandlers.set(`${queue}:${name}`, handler);
}

export interface EnqueueOptions {
  /** Deterministic dedupe key — identical keys collapse into one job. */
  dedupeKey?: string;
  delayMs?: number;
}

/**
 * Enqueue a job. Fire-and-forget for callers: a queue outage must never fail
 * the request path (failure mode #4 → 503 only when the spec demands it).
 */
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
      log.debug({ queue, name, data, dedupeKey: options.dedupeKey }, 'job enqueued (inline stub — no handler)');
    }
    return;
  }
  // Phase 10: BullMQ Queue.add with attempts/backoff/removeOnComplete defaults.
  log.warn({ queue, name }, 'QUEUE_DISABLED=false but BullMQ wiring lands in Phase 10 — job dropped');
}

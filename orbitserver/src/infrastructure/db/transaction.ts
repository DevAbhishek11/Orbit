/**
 * Transaction runner (BUILD_PROMPT rule 7).
 *
 * - On a replica set / mongos: real multi-document transactions via
 *   `session.withTransaction`, retrying TransientTransactionError automatically.
 * - On deployments WITHOUT transaction support (e.g. Atlas M0 free tier):
 *   operations run sequentially with best-effort compensation (rollback hooks
 *   the caller registers), and every fallback is logged loudly. The env flag
 *   MONGO_REQUIRE_TRANSACTIONS=true converts this situation into a boot failure.
 *
 * Services write against `runInTransaction(fn)` and stay agnostic.
 */
import type mongoose from 'mongoose';
import { getConnection, getDbRuntimeInfo } from './mongoose.js';
import { childLogger } from '../logger/index.js';

const log = childLogger({ module: 'transaction' });

export interface TxContext {
  /** Mongoose session — undefined when running in fallback mode. */
  session?: mongoose.ClientSession;
  /** True when a real transaction is active. */
  readonly isTransactional: boolean;
  /**
   * Register an undo hook (fallback mode only). Hooks run in reverse order
   * when a later step throws — best-effort compensation.
   */
  compensate(undo: () => Promise<void>): void;
}

const MAX_TX_RETRIES = 3;

function isTransientTxError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { errorLabels?: string[]; code?: number };
  return (
    Array.isArray(e.errorLabels) && e.errorLabels.includes('TransientTransactionError')
  ) || e.code === 251; // NoSuchTransaction
}

/**
 * Execute `work` atomically when the deployment allows it.
 * Returns whatever `work` returns; throws the original error on failure.
 */
export async function runInTransaction<T>(
  work: (tx: TxContext) => Promise<T>,
  options: { name?: string } = {},
): Promise<T> {
  const conn = getConnection();
  const { transactionsSupported } = getDbRuntimeInfo();
  const name = options.name ?? 'transaction';

  if (!transactionsSupported) {
    return runWithCompensation(work, name);
  }

  let attempt = 0;
  for (;;) {
    attempt += 1;
    const session = await conn.startSession();
    try {
      let result!: T;
      await session.withTransaction(
        async () => {
          const tx: TxContext = {
            session,
            isTransactional: true,
            compensate: () => undefined, // real rollback — compensations not needed
          };
          result = await work(tx);
        },
        {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          readPreference: 'primary',
        },
      );
      return result;
    } catch (err) {
      if (isTransientTxError(err) && attempt < MAX_TX_RETRIES) {
        log.warn({ name, attempt, err: (err as Error).message }, 'transient transaction error — retrying');
        continue;
      }
      throw err;
    } finally {
      await session.endSession().catch(() => undefined);
    }
  }
}

/** Fallback: sequential execution + reverse-order compensation hooks. */
async function runWithCompensation<T>(work: (tx: TxContext) => Promise<T>, name: string): Promise<T> {
  log.debug({ name }, 'running multi-write without transaction support (compensation mode)');
  const undos: Array<() => Promise<void>> = [];
  const tx: TxContext = {
    session: undefined,
    isTransactional: false,
    compensate(undo: () => Promise<void>) {
      undos.push(undo);
    },
  };
  try {
    return await work(tx);
  } catch (err) {
    log.warn({ name, err: (err as Error).message, steps: undos.length }, 'compensating partial writes');
    for (const undo of undos.reverse()) {
      try {
        await undo();
      } catch (undoErr) {
        log.error({ name, err: undoErr }, 'compensation step failed — data may need manual repair');
      }
    }
    throw err;
  }
}

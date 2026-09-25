import type mongoose from 'mongoose';
import { getConnection, getDbRuntimeInfo } from './mongoose.js';
import { childLogger } from '../logger/index.js';

const log = childLogger({ module: 'transaction' });

export interface TxContext {
  session?: mongoose.ClientSession;

  readonly isTransactional: boolean;

  compensate(undo: () => Promise<void>): void;
}

const MAX_TX_RETRIES = 3;

function isTransientTxError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { errorLabels?: string[]; code?: number };
  return (
    (Array.isArray(e.errorLabels) && e.errorLabels.includes('TransientTransactionError')) ||
    e.code === 251
  );
}

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
            compensate: () => undefined,
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
        log.warn(
          { name, attempt, err: (err as Error).message },
          'transient transaction error — retrying',
        );
        continue;
      }
      throw err;
    } finally {
      await session.endSession().catch(() => undefined);
    }
  }
}

async function runWithCompensation<T>(
  work: (tx: TxContext) => Promise<T>,
  name: string,
): Promise<T> {
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
    log.warn(
      { name, err: (err as Error).message, steps: undos.length },
      'compensating partial writes',
    );
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

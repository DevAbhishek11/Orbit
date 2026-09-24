/**
 * Mongoose connection management (BUILD_PROMPT Phase 2).
 *  - pool sizing from env
 *  - slow-query logging via profiler hooks
 *  - topology probe: records whether the deployment supports transactions
 *    (Atlas M0 free tier historically does NOT — the app must know at boot)
 *  - connection event logging
 */
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { childLogger } from '../logger/index.js';

const log = childLogger({ module: 'db' });

export interface DbRuntimeInfo {
  connected: boolean;
  readyState: number;
  topology: 'replicaSet' | 'sharded' | 'standalone' | 'unknown';
  transactionsSupported: boolean;
  serverVersion: string;
  dbName: string;
}

let runtimeInfo: DbRuntimeInfo = {
  connected: false,
  readyState: 0,
  topology: 'unknown',
  transactionsSupported: false,
  serverVersion: 'unknown',
  dbName: env.MONGO_DB_NAME,
};

export function getDbRuntimeInfo(): DbRuntimeInfo {
  return runtimeInfo;
}

/** Probe topology + run a real 2-document transaction to prove support. */
async function probeTopology(conn: mongoose.Connection): Promise<void> {
  const admin = conn.db?.admin();
  let topology: DbRuntimeInfo['topology'] = 'unknown';
  let version = 'unknown';
  try {
    const hello = await admin?.command({ hello: 1 });
    version = String((await admin?.command({ buildInfo: 1 }))?.version ?? 'unknown');
    if (hello?.msg === 'isdbgrid') topology = 'sharded';
    else if (hello?.setName) topology = 'replicaSet';
    else topology = 'standalone';
  } catch (err) {
    log.warn({ err }, 'topology probe failed');
  }

  let transactionsSupported = false;
  if (topology === 'replicaSet' || topology === 'sharded') {
    // Empirical check: some managed tiers (Atlas M0) expose a replica set name
    // yet reject transactions — probe with a throwaway database.
    const probeDb = mongoose.connection.useDb('orbit_tx_probe');
    try {
      const session = await conn.startSession();
      try {
        await session.withTransaction(async () => {
          await probeDb.collection('probe').insertOne({ probe: true }, { session });
          await probeDb.collection('probe2').insertOne({ probe: true }, { session });
        });
        transactionsSupported = true;
      } finally {
        await session.endSession();
      }
      await probeDb.dropDatabase().catch(() => undefined);
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'transaction probe failed — running without transactions');
    }
  }

  runtimeInfo = { ...runtimeInfo, topology, transactionsSupported, serverVersion: version };

  if (env.MONGO_REQUIRE_TRANSACTIONS && !transactionsSupported) {
    log.fatal(
      { topology, version },
      'MONGO_REQUIRE_TRANSACTIONS=true but this deployment cannot run transactions — refusing to start',
    );
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  }
  log.info(
    { topology, version, transactionsSupported },
    `connected to MongoDB${transactionsSupported ? '' : ' (transactions UNAVAILABLE — writes will be sequential with compensations)'}`,
  );
}

function registerSlowQueryLogging(conn: mongoose.Connection): void {
  if (env.MONGO_SLOW_QUERY_MS <= 0) return;
  const started = new WeakMap<object, number>();
  for (const op of ['find', 'findOne', 'updateOne', 'updateMany', 'insertOne', 'aggregate'] as const) {
    conn.on(op, (info: { collectionName?: string } & object) => {
      started.set(info, Date.now());
    });
  }
  conn.on('complete', (info: object & { collectionName?: string; methodName?: string }) => {
    const t0 = started.get(info);
    if (t0 === undefined) return;
    const ms = Date.now() - t0;
    if (ms >= env.MONGO_SLOW_QUERY_MS) {
      log.warn(
        { op: info.methodName, collection: info.collectionName, durationMs: ms },
        'slow query detected',
      );
    }
  });
}

export async function connectDatabase(): Promise<mongoose.Connection> {
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGO_DB_NAME,
      maxPoolSize: env.MONGO_MAX_POOL_SIZE,
      minPoolSize: env.MONGO_MIN_POOL_SIZE,
      serverSelectionTimeoutMS: env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
      // Heartbeats keep Atlas idle clusters warm and detect failovers fast.
      heartbeatFrequencyMS: 10_000,
      retryWrites: true,
      retryReads: true,
      autoIndex: false, // indexes are synced explicitly (scripts/syncIndexes)
    appName: 'orbit-api',
  }).catch((err: unknown) => {
    log.fatal({ err }, 'MongoDB connection failed at boot');
    throw err;
  });
  const conn = mongoose.connection;

  runtimeInfo = { ...runtimeInfo, connected: true, readyState: conn.readyState };

  conn.on('disconnected', () => {
    runtimeInfo = { ...runtimeInfo, connected: false };
    log.warn('MongoDB disconnected');
  });
  conn.on('reconnected', () => {
    runtimeInfo = { ...runtimeInfo, connected: true };
    log.info('MongoDB reconnected');
  });
  conn.on('error', (err: Error) => log.error({ err }, 'MongoDB connection error'));

  registerSlowQueryLogging(conn);
  await probeTopology(conn);
  return conn;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  runtimeInfo = { ...runtimeInfo, connected: false };
  log.info('MongoDB disconnected cleanly');
}

/** Convenience accessor used by repositories that need the raw connection. */
export function getConnection(): mongoose.Connection {
  return mongoose.connection;
}

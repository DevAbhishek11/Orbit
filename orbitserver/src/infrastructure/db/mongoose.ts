import child_process from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { childLogger } from '../logger/index.js';

const log = childLogger({ module: 'db' });

let localDbProcess: child_process.ChildProcess | null = null;

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
    const session = await conn.startSession();
    try {
      await conn.db!.createCollection('__transaction_probe').catch(() => undefined);
      session.startTransaction();
      await conn.collection('__transaction_probe').insertOne({ probe: true }, { session });
      await session.abortTransaction();
      transactionsSupported = true;
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'transaction probe failed');
    } finally {
      await session.endSession();
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
  for (const op of [
    'find',
    'findOne',
    'updateOne',
    'updateMany',
    'insertOne',
    'aggregate',
  ] as const) {
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

async function startLocalMongoServer(): Promise<string> {
  const serverPath = path.resolve(
    process.cwd(),
    '../node_modules/@rckflr/easydb-server/bin/easydb-server.js',
  );
  const altPath = path.resolve(
    process.cwd(),
    'node_modules/@rckflr/easydb-server/bin/easydb-server.js',
  );
  const targetScript = fs.existsSync(serverPath) ? serverPath : altPath;

  localDbProcess = child_process.spawn(
    process.execPath,
    [targetScript, '--port', '27018', '-a', 'memory'],
    {
      stdio: 'ignore',
      detached: false,
    },
  );

  localDbProcess.unref();
  await new Promise((resolve) => setTimeout(resolve, 800));
  return `mongodb://127.0.0.1:27018/${env.MONGO_DB_NAME}`;
}

export async function connectDatabase(): Promise<mongoose.Connection> {
  mongoose.set('strictQuery', true);

  let targetUri = env.MONGODB_URI;

  try {
    await mongoose.connect(targetUri, {
      dbName: env.MONGO_DB_NAME,
      maxPoolSize: env.MONGO_MAX_POOL_SIZE,
      minPoolSize: env.MONGO_MIN_POOL_SIZE,
      serverSelectionTimeoutMS: 3000,
      heartbeatFrequencyMS: 10_000,
      retryWrites: true,
      retryReads: true,
      autoIndex: false,
      appName: 'orbit-api',
    });
  } catch (initialErr) {
    log.warn(
      { err: (initialErr as Error).message },
      'Remote MongoDB unavailable — starting local embedded wire-protocol MongoDB engine',
    );
    targetUri = await startLocalMongoServer();
    await mongoose.connect(targetUri, {
      dbName: env.MONGO_DB_NAME,
      serverSelectionTimeoutMS: 5000,
      autoIndex: false,
      appName: 'orbit-api',
    });
  }

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
  if (localDbProcess) {
    try {
      localDbProcess.kill('SIGTERM');
    } catch {
      void 0;
    }
  }
  runtimeInfo = { ...runtimeInfo, connected: false };
  log.info('MongoDB disconnected cleanly');
}

export function getConnection(): mongoose.Connection {
  return mongoose.connection;
}

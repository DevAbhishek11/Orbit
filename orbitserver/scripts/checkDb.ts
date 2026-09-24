/**
 * Database connectivity probe — answers "is my MONGODB_URI actually usable?"
 * without starting the API.
 *
 *   npm run check-db
 *
 * Reports the resolved host, the topology, the server version, whether
 * multi-document TRANSACTIONS work on this deployment (Atlas M0 has
 * historically rejected them), the existing collections and their document
 * counts, and finally proves a real write + delete round trip.
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { logger } from '../src/infrastructure/logger/index.js';
import { connectDatabase, disconnectDatabase, getDbRuntimeInfo } from '../src/infrastructure/db/mongoose.js';

async function main(): Promise<void> {
  // Print the URI with the password masked — this output gets pasted into issues.
  const masked = env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, (_m, user: string) => `//${user}:***@`);
  logger.info({ uri: masked, dbName: env.MONGO_DB_NAME }, 'connecting');

  await connectDatabase();
  const info = getDbRuntimeInfo();
  logger.info(info, 'connection established');

  const db = mongoose.connection.db;
  if (!db) throw new Error('no database handle after connect');

  const collections = await db.listCollections().toArray();
  const counts: Record<string, number> = {};
  for (const collection of collections) {
    counts[collection.name] = await db.collection(collection.name).estimatedDocumentCount();
  }
  logger.info({ collections: counts }, 'existing data');

  const probe = db.collection('__connectivity_probe');
  const inserted = await probe.insertOne({ at: new Date() });
  await probe.deleteOne({ _id: inserted.insertedId });
  logger.info({ insertedId: String(inserted.insertedId) }, 'write + delete round trip OK');

  await disconnectDatabase();
  logger.info(
    {
      transactionsSupported: info.transactionsSupported,
      topology: info.topology,
      serverVersion: info.serverVersion,
    },
    info.transactionsSupported
      ? 'database is fully usable (transactions available)'
      : 'database reachable, but TRANSACTIONS are unavailable — multi-write operations run in compensation mode',
  );
  process.exit(0);
}

main().catch((err: unknown) => {
  logger.fatal({ err: (err as Error).message }, 'database check FAILED');
  process.exit(1);
});

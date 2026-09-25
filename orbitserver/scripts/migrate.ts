import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { logger } from '../src/infrastructure/logger/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

interface Migration {
  id: string;
  description?: string;
  up: (db: mongoose.Connection) => Promise<void>;
  down?: (db: mongoose.Connection) => Promise<void>;
}

interface MigrationRecord {
  _id: string;
  appliedAt: Date;
}

async function getMigrationFiles(): Promise<string[]> {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
  return files.sort();
}

async function loadMigration(file: string): Promise<Migration> {
  const full = path.join(MIGRATIONS_DIR, file);
  const mod = await import(full);
  const m = (mod.default ?? mod) as Migration;
  if (!m?.id || typeof m.up !== 'function') {
    throw new Error(`Invalid migration file ${file}: must export { id, up }`);
  }
  return m;
}

async function main() {
  const command = process.argv[2] ?? 'up';

  if (command === 'create') {
    const name = process.argv[3];
    if (!name) {
      console.error('Usage: npm run migrate:create -- <name>');
      process.exit(1);
    }
    if (!fs.existsSync(MIGRATIONS_DIR)) fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const id = `${ts}_${name.replace(/[^a-z0-9_-]/gi, '_')}`;
    const file = path.join(MIGRATIONS_DIR, `${id}.ts`);
    const template = `import type mongoose from 'mongoose';

export const id = '${id}';
export const description = '${name}';

export async function up(db: mongoose.Connection): Promise<void> {
  // Example: await db.collection('users').updateMany({}, { $set: { newField: null } });
}

export async function down(db: mongoose.Connection): Promise<void> {
  // Reverse of up — best effort
}
`;
    fs.writeFileSync(file, template, 'utf8');
    console.log(`Created ${file}`);
    process.exit(0);
  }

  logger.info({ uri: env.MONGODB_URI ? 'set' : 'missing' }, 'connecting for migrations');
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGO_DB_NAME,
    serverSelectionTimeoutMS: env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    autoIndex: false,
  });
  const conn = mongoose.connection;
  const col = conn.collection<MigrationRecord>('migrations');

  const files = await getMigrationFiles();
  const migrations: Migration[] = [];
  for (const f of files) {
    try {
      migrations.push(await loadMigration(f));
    } catch (e) {
      logger.error({ file: f, err: e }, 'failed to load migration');
      process.exit(1);
    }
  }

  const applied = new Set((await col.find().toArray()).map((r) => r._id));

  if (command === 'status') {
    console.log('Applied:');
    for (const id of [...applied].sort()) console.log(`  ✓ ${id}`);
    console.log('\nPending:');
    for (const m of migrations)
      if (!applied.has(m.id)) console.log(`  ○ ${m.id} — ${m.description ?? ''}`);
    await mongoose.disconnect();
    process.exit(0);
  }

  if (command === 'down') {
    const target = process.argv[3];
    if (!target) {
      console.error('Usage: npm run migrate:down -- <migration-id>');
      process.exit(1);
    }
    const m = migrations.find((x) => x.id === target);
    if (!m) {
      console.error(`Migration ${target} not found`);
      process.exit(1);
    }
    if (!applied.has(m.id)) {
      console.error(`Migration ${target} not applied`);
      process.exit(1);
    }
    if (!m.down) {
      console.error(`Migration ${target} has no down()`);
      process.exit(1);
    }
    logger.info({ id: m.id }, 'rolling back migration');
    await m.down(conn);
    await col.deleteOne({ _id: m.id } as any);
    logger.info({ id: m.id }, 'rolled back');
    await mongoose.disconnect();
    process.exit(0);
  }

  let ran = 0;
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    logger.info({ id: m.id }, 'applying migration');
    try {
      await m.up(conn);
      await col.insertOne({ _id: m.id, appliedAt: new Date() } as any);
      ran++;
      logger.info({ id: m.id }, 'migration applied');
    } catch (err) {
      logger.error({ id: m.id, err }, 'migration FAILED — stopping');
      await mongoose.disconnect();
      process.exit(1);
    }
  }
  logger.info({ ran, total: migrations.length }, 'migrations complete');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  logger.fatal({ err }, 'migrate crashed');
  process.exit(1);
});

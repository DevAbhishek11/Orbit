import type mongoose from 'mongoose';

export const id = '20240101_000000_init';
export const description = 'Baseline — ensures migrations collection exists (no-op)';

export async function up(_db: mongoose.Connection): Promise<void> {
  // Baseline migration — collections are created by Mongoose on first write.
  // Keeping this as a no-op so that future migrations have a clean starting point.
}

export async function down(_db: mongoose.Connection): Promise<void> {
  // no-op
}

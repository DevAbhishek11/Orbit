/**
 * Soft-delete plugin (BUILD_PROMPT rule 8): adds `deletedAt`/`deletedBy`,
 * filters deleted documents from every query by default, and exposes
 * restore()/purge() statics plus `.deleted()`/`.withDeleted()` query helpers.
 * A 30-day purge job (Phase 10) hard-deletes expired trash.
 */
import type { Aggregate, HydratedDocument, Model, Query, Schema } from 'mongoose';

export interface SoftDeleteFields {
  deletedAt: Date | null;
  deletedBy: string | null;
}

export interface SoftDeleteStatics {
  restore(filter: Record<string, unknown>): Query<unknown, unknown>;
  purge(filter: Record<string, unknown>): Query<unknown, unknown>;
}

export interface SoftDeleteQueryHelpers {
  deleted(): Query<unknown, unknown, SoftDeleteQueryHelpers>;
  withDeleted(): Query<unknown, unknown, SoftDeleteQueryHelpers>;
}

export type SoftDeleteModel<TDoc, TMethods = object> = Model<
  TDoc & SoftDeleteFields,
  SoftDeleteQueryHelpers,
  TMethods & SoftDeleteStatics
>;

type AnyQuery = Query<unknown, HydratedDocument<SoftDeleteFields>, SoftDeleteQueryHelpers>;

const QUERY_HOOKS = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'countDocuments',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
] as const;

function shouldSkipFiltering(query: AnyQuery): boolean {
  const opts = query.mongooseOptions();
  return (opts as { includeDeleted?: boolean }).includeDeleted === true;
}

export function softDeletePlugin(schema: Schema): void {
  schema.add({
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  });
  schema.index({ deletedAt: 1, updatedAt: -1 });

  // Default scope: hide soft-deleted documents unless the caller opts in.
  for (const hook of QUERY_HOOKS) {
    schema.pre(hook as 'find', function injectScope(this: AnyQuery) {
      if (shouldSkipFiltering(this)) return;
      const filter = this.getFilter() as Record<string, unknown>;
      if (!('deletedAt' in filter)) filter.deletedAt = null;
    });
  }

  schema.pre('aggregate', function injectAggregateScope(this: Aggregate<unknown>) {
    const pipeline = this.pipeline() as unknown as Array<Record<string, unknown>>;
    const first = pipeline[0] as { $match?: Record<string, unknown> } | undefined;
    if (first?.$match && 'deletedAt' in first.$match) return;
    pipeline.unshift({ $match: { deletedAt: null } });
  });

  // Escape hatches: trash views and the purge job.
  const queryHelpers = schema.query as unknown as SoftDeleteQueryHelpers;
  queryHelpers.deleted = function deleted(this: AnyQuery) {
    const filter = this.getFilter() as Record<string, unknown>;
    delete filter.deletedAt;
    filter.deletedAt = { $ne: null };
    return this;
  };
  queryHelpers.withDeleted = function withDeleted(this: AnyQuery) {
    this.mongooseOptions().includeDeleted = true;
    return this;
  };

  // Statics target deleted docs explicitly (the pre-hook skips injection when
  // the caller's filter already mentions deletedAt).
  schema.statics.restore = function restore(
    this: Model<SoftDeleteFields>,
    filter: Record<string, unknown>,
  ) {
    return this.findOneAndUpdate(
      { ...filter, deletedAt: { $ne: null } },
      { $set: { deletedAt: null, deletedBy: null } },
    );
  };

  schema.statics.purge = function purge(
    this: Model<SoftDeleteFields>,
    filter: Record<string, unknown>,
  ) {
    return this.deleteMany({ ...filter, deletedAt: { $ne: null } });
  };
}

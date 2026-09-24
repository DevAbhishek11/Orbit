/**
 * Workspace model (BUILD_PROMPT Phase 5) — the tenant boundary.
 * Every tenant document carries workspaceId; every query filters by it.
 * `stats` are denormalized counters kept correct inside transactions.
 */
import { Schema, model, type Model } from 'mongoose';
import { WORKSPACE } from '@orbit/shared';
import {
  softDeletePlugin,
  type SoftDeleteFields,
  type SoftDeleteQueryHelpers,
  type SoftDeleteStatics,
} from '../../plugins/softDelete.js';

export type WorkspacePlan = 'free' | 'pro';

export interface IWorkspace extends SoftDeleteFields {
  name: string;
  slug: string;
  logoUrl?: string;
  plan: WorkspacePlan;
  seatLimit: number;
  storageQuotaBytes: number;
  settings: {
    timezone: string;
    weekStart: 0 | 1; // 0 = Sunday, 1 = Monday
    defaultRole: 'member' | 'viewer';
  };
  stats: {
    memberCount: number;
    boardCount: number;
    pageCount: number;
    channelCount: number;
  };
  createdBy: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 48,
      match: /^[a-z0-9-]+$/,
    },
    logoUrl: { type: String, maxlength: 2048 },
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    seatLimit: { type: Number, default: WORKSPACE.FREE_SEAT_LIMIT },
    storageQuotaBytes: { type: Number, default: WORKSPACE.FREE_STORAGE_QUOTA_BYTES },
    settings: {
      timezone: { type: String, default: 'UTC' },
      weekStart: { type: Number, enum: [0, 1], default: 1 },
      defaultRole: { type: String, enum: ['member', 'viewer'], default: 'member' },
    },
    stats: {
      memberCount: { type: Number, default: 1 },
      boardCount: { type: Number, default: 0 },
      pageCount: { type: Number, default: 0 },
      channelCount: { type: Number, default: 0 },
    },
    createdBy: { type: String, required: true },
    archivedAt: { type: Date, default: null },
  },
  { collection: 'workspaces', timestamps: true },
);

workspaceSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
workspaceSchema.index({ createdBy: 1, updatedAt: -1 });
workspaceSchema.index({ 'stats.memberCount': 1 });

softDeletePlugin(workspaceSchema);

export const WorkspaceModel = model<
  IWorkspace,
  Model<IWorkspace, SoftDeleteQueryHelpers> & SoftDeleteStatics
>(
  'Workspace',
  workspaceSchema,
);

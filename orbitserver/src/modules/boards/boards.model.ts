/**
 * Board model (BUILD_PROMPT Phase 6).
 * visibility: workspace (every member) | private (explicit memberIds).
 * Private boards the caller can't see answer 404 — never 403 (rule 6).
 */
import { Schema, model, type Model } from 'mongoose';
import {
  softDeletePlugin,
  type SoftDeleteFields,
  type SoftDeleteQueryHelpers,
  type SoftDeleteStatics,
} from '../../plugins/softDelete.js';

export type BoardVisibility = 'workspace' | 'private';

export interface IBoard extends SoftDeleteFields {
  workspaceId: string;
  name: string;
  description?: string;
  visibility: BoardVisibility;
  memberIds: string[];
  background: string; // token key: 'gradient-1' | 'solid-blue' | ...
  createdBy: string;
  stats: {
    listCount: number;
    cardCount: number;
  };
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const boardSchema = new Schema<IBoard>(
  {
    workspaceId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 2_000 },
    visibility: { type: String, enum: ['workspace', 'private'], default: 'workspace' },
    memberIds: { type: [String], default: [] },
    background: { type: String, default: 'gradient-1', maxlength: 40 },
    createdBy: { type: String, required: true },
    stats: {
      listCount: { type: Number, default: 0 },
      cardCount: { type: Number, default: 0 },
    },
    archivedAt: { type: Date, default: null },
  },
  { collection: 'boards', timestamps: true },
);

// Board index page: my workspace's boards, active first, recently updated first.
boardSchema.index({ workspaceId: 1, archivedAt: 1, updatedAt: -1 });
// Private-board access guard lookups.
boardSchema.index({ workspaceId: 1, visibility: 1, memberIds: 1 });
boardSchema.index({ createdBy: 1 });
boardSchema.index({ name: 'text', description: 'text' });

softDeletePlugin(boardSchema);

export const BoardModel = model<
  IBoard,
  Model<IBoard, SoftDeleteQueryHelpers> & SoftDeleteStatics
>(
  'Board',
  boardSchema,
);

/**
 * List (Kanban column) model — ordering via fractional string keys (rule 9).
 * `cardCount` is denormalized and kept correct inside the move transaction.
 */
import { Schema, model, type Model } from 'mongoose';
import {
  softDeletePlugin,
  type SoftDeleteFields,
  type SoftDeleteQueryHelpers,
  type SoftDeleteStatics,
} from '../../plugins/softDelete.js';

export interface IList extends SoftDeleteFields {
  workspaceId: string;
  boardId: string;
  name: string;
  order: string; // fractional key — base62, sorts lexicographically
  color?: string;
  wipLimit?: number | null;
  cardCount: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const listSchema = new Schema<IList>(
  {
    workspaceId: { type: String, required: true },
    boardId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    order: { type: String, required: true, maxlength: 64 },
    color: { type: String, maxlength: 20 },
    wipLimit: { type: Number, default: null, min: 1, max: 500 },
    cardCount: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null },
  },
  { collection: 'lists', timestamps: true },
);

// THE hot index: board render sorts lists by fractional order.
listSchema.index({ boardId: 1, order: 1 });
listSchema.index({ workspaceId: 1, archivedAt: 1 });

softDeletePlugin(listSchema);

export const ListModel = model<
  IList,
  Model<IList, SoftDeleteQueryHelpers> & SoftDeleteStatics
>(
  'List',
  listSchema,
);

import { Schema, model, type Model } from 'mongoose';
import { CONTENT } from '@orbit/shared';
import {
  softDeletePlugin,
  type SoftDeleteFields,
  type SoftDeleteQueryHelpers,
  type SoftDeleteStatics,
} from '../../plugins/softDelete.js';

export type CardPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export interface ICardLabel {
  id: string;
  name: string;
  color: string;
}

export interface IChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export interface IChecklist {
  id: string;
  title: string;
  items: IChecklistItem[];
}

export interface ICardAttachment {
  fileId: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: Date;
}

export interface ICard extends SoftDeleteFields {
  workspaceId: string;
  boardId: string;
  listId: string;
  title: string;
  description?: string;
  order: string;
  labels: ICardLabel[];
  checklists: IChecklist[];
  assignees: string[];
  dueAt: Date | null;
  startAt: Date | null;
  completedAt: Date | null;
  priority: CardPriority;
  coverColor?: string;
  coverFileId?: string;
  attachments: ICardAttachment[];
  commentCount: number;
  attachmentCount: number;
  checklistProgress: { done: number; total: number };
  watcherIds: string[];
  sourceMessageId?: string | null;
  pageId?: string | null;
  version: number;
  createdBy: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const checklistItemSchema = new Schema<IChecklistItem>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    done: { type: Boolean, default: false },
  },
  { _id: false },
);

const checklistSchema = new Schema<IChecklist>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    items: { type: [checklistItemSchema], default: [] },
  },
  { _id: false },
);

const labelSchema = new Schema<ICardLabel>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, maxlength: 40 },
    color: { type: String, required: true, maxlength: 20 },
  },
  { _id: false },
);

const attachmentSchema = new Schema<ICardAttachment>(
  {
    fileId: { type: String, required: true },
    name: { type: String, required: true, maxlength: 240 },
    sizeBytes: { type: Number, required: true, min: 0 },
    mimeType: { type: String, required: true, maxlength: 120 },
    uploadedBy: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const cardSchema = new Schema<ICard>(
  {
    workspaceId: { type: String, required: true },
    boardId: { type: String, required: true },
    listId: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: CONTENT.CARD_TITLE_MAX },
    description: { type: String, maxlength: CONTENT.CARD_DESCRIPTION_MAX },
    order: { type: String, required: true, maxlength: 64 },
    labels: {
      type: [labelSchema],
      default: [],
      validate: (v: ICardLabel[]) => v.length <= CONTENT.LABELS_PER_CARD,
    },
    checklists: {
      type: [checklistSchema],
      default: [],
      validate: (v: IChecklist[]) =>
        v.length <= CONTENT.CHECKLISTS_PER_CARD &&
        v.every((c) => c.items.length <= CONTENT.CHECKLIST_ITEMS),
    },
    assignees: { type: [String], default: [] },
    dueAt: { type: Date, default: null },
    startAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    priority: {
      type: String,
      enum: ['none', 'low', 'medium', 'high', 'urgent'],
      default: 'none',
    },
    coverColor: { type: String, maxlength: 20 },
    coverFileId: { type: String },
    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: (v: ICardAttachment[]) => v.length <= CONTENT.ATTACHMENTS_PER_CARD,
    },
    commentCount: { type: Number, default: 0 },
    attachmentCount: { type: Number, default: 0 },
    checklistProgress: {
      done: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    watcherIds: { type: [String], default: [] },
    sourceMessageId: { type: String, default: null },
    pageId: { type: String, default: null },
    version: { type: Number, default: 1 },
    createdBy: { type: String, required: true },
    archivedAt: { type: Date, default: null },
  },
  { collection: 'cards', timestamps: true },
);

cardSchema.index({ listId: 1, order: 1 });
cardSchema.index({ boardId: 1, archivedAt: 1, dueAt: 1 });
cardSchema.index({ workspaceId: 1, assignees: 1, completedAt: 1 });
cardSchema.index({ dueAt: 1 }, { partialFilterExpression: { completedAt: null, deletedAt: null } });
cardSchema.index({ sourceMessageId: 1 }, { sparse: true });
cardSchema.index({ pageId: 1 }, { sparse: true });
cardSchema.index({ title: 'text', description: 'text' });
cardSchema.index({ workspaceId: 1, updatedAt: -1 });

softDeletePlugin(cardSchema);

export const CardModel = model<ICard, Model<ICard, SoftDeleteQueryHelpers> & SoftDeleteStatics>(
  'Card',
  cardSchema,
);

export function computeChecklistProgress(card: Pick<ICard, 'checklists'>): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const checklist of card.checklists) {
    total += checklist.items.length;
    done += checklist.items.filter((i) => i.done).length;
  }
  return { done, total };
}

/**
 * Pages model (BUILD_PROMPT Phase 7 — Notion pillar):
 * Materialized path hierarchy (ancestors + depth), fractional order,
 * block content, version counter for autosave conflict detection.
 */
import mongoose, { type Document, Schema } from 'mongoose';
import { CONTENT } from '@orbit/shared';
import { softDeletePlugin } from '../../plugins/softDelete.js';

export interface PageBlock {
  id: string;
  type:
    | 'paragraph'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'bullet'
    | 'numbered'
    | 'todo'
    | 'quote'
    | 'code'
    | 'divider'
    | 'callout';
  content: string;
  order: string;
  checked?: boolean;
  language?: string;
}

export interface PageDoc extends Document {
  workspaceId: string;
  title: string;
  icon?: string | null;
  cover?: string | null;
  parentId: string | null;
  ancestors: string[];
  depth: number;
  order: string;
  blocks: PageBlock[];
  plainText: string;
  visibility: 'workspace' | 'private' | 'link';
  allowedUserIds: string[];
  favouriteOf: string[];
  version: number;
  lastSnapshotAt?: Date;
  createdBy: string;
  archivedAt?: Date | null;
  deletedAt?: Date | null;
  deletedFrom?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PageBlockSchema = new Schema<PageBlock>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'paragraph',
        'h1',
        'h2',
        'h3',
        'bullet',
        'numbered',
        'todo',
        'quote',
        'code',
        'divider',
        'callout',
      ],
      default: 'paragraph',
    },
    content: { type: String, default: '', maxlength: CONTENT.BLOCK_TEXT_MAX },
    order: { type: String, required: true },
    checked: { type: Boolean, default: false },
    language: { type: String, default: 'text' },
  },
  { _id: false },
);

const PageSchema = new Schema<PageDoc>(
  {
    workspaceId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: CONTENT.PAGE_TITLE_MAX },
    icon: { type: String, default: '📄' },
    cover: { type: String, default: null },
    parentId: { type: String, default: null, index: true },
    ancestors: [{ type: String }],
    depth: { type: Number, default: 0, min: 0, max: CONTENT.PAGE_MAX_DEPTH },
    order: { type: String, required: true },
    blocks: { type: [PageBlockSchema], default: [] },
    plainText: { type: String, default: '' },
    visibility: {
      type: String,
      enum: ['workspace', 'private', 'link'],
      default: 'workspace',
      index: true,
    },
    allowedUserIds: [{ type: String }],
    favouriteOf: [{ type: String }],
    version: { type: Number, default: 1 },
    lastSnapshotAt: { type: Date, default: null },
    createdBy: { type: String, required: true, index: true },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedFrom: { type: String, default: null },
  },
  { timestamps: true, collection: 'pages' },
);

PageSchema.plugin(softDeletePlugin);

PageSchema.index({ workspaceId: 1, parentId: 1, order: 1 });
PageSchema.index({ workspaceId: 1, deletedAt: 1, updatedAt: -1 });
PageSchema.index({ workspaceId: 1, ancestors: 1 });
PageSchema.index({ title: 'text', plainText: 'text' }, { weights: { title: 3, plainText: 1 } });

export const PageModel = mongoose.model<PageDoc>('Page', PageSchema);

/**
 * Page version history model (BUILD_PROMPT Phase 7).
 */
import mongoose, { type Document, Schema } from 'mongoose';
import type { PageBlock } from './pages.model.js';

export interface PageVersionDoc extends Document {
  pageId: string;
  workspaceId: string;
  version: number;
  title: string;
  blocks: PageBlock[];
  snapshotReason: string;
  createdBy: string;
  createdAt: Date;
}

const PageVersionSchema = new Schema<PageVersionDoc>(
  {
    pageId: { type: String, required: true, index: true },
    workspaceId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    title: { type: String, required: true },
    blocks: [Schema.Types.Mixed],
    snapshotReason: { type: String, default: 'manual' },
    createdBy: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'pageversions' },
);

PageVersionSchema.index({ pageId: 1, version: -1 });

export const PageVersionModel = mongoose.model<PageVersionDoc>('PageVersion', PageVersionSchema);

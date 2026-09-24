/**
 * Channels model (BUILD_PROMPT Phase 8 — Slack pillar):
 * Public, private and DM channels with denormalized lastMessage & counters.
 */
import mongoose, { type Document, Schema } from 'mongoose';
import { softDeletePlugin } from '../../plugins/softDelete.js';

export interface ChannelLastMessage {
  _id: string;
  authorId: string;
  preview: string;
  at: Date;
}

export interface ChannelDoc extends Document {
  workspaceId: string;
  name: string;
  slug: string;
  type: 'public' | 'private' | 'dm';
  topic?: string;
  memberIds: string[];
  lastMessage?: ChannelLastMessage | null;
  messageCount: number;
  createdBy: string;
  archivedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelSchema = new Schema<ChannelDoc>(
  {
    workspaceId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    type: { type: String, enum: ['public', 'private', 'dm'], default: 'public', index: true },
    topic: { type: String, default: '', maxlength: 250 },
    memberIds: [{ type: String }],
    lastMessage: {
      type: new Schema(
        {
          _id: { type: String, required: true },
          authorId: { type: String, required: true },
          preview: { type: String, required: true },
          at: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    messageCount: { type: Number, default: 0 },
    createdBy: { type: String, required: true, index: true },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'channels' },
);

ChannelSchema.plugin(softDeletePlugin);

ChannelSchema.index({ workspaceId: 1, type: 1 });
ChannelSchema.index({ workspaceId: 1, slug: 1 });

export const ChannelModel = mongoose.model<ChannelDoc>('Channel', ChannelSchema);

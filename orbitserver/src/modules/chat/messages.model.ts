/**
 * Messages model (BUILD_PROMPT Phase 8 — Slack pillar):
 * Timeline & threads, mentions, embedded reactions and idempotent clientId.
 */
import mongoose, { type Document, Schema } from 'mongoose';
import { CONTENT } from '@orbit/shared';
import { softDeletePlugin } from '../../plugins/softDelete.js';

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface MessageDoc extends Document {
  workspaceId: string;
  channelId: string;
  authorId: string;
  body: string;
  mentions: string[];
  fileIds: string[];
  parentId?: string | null;
  threadRootId?: string | null;
  replyCount: number;
  lastReplyAt?: Date | null;
  reactions: Reaction[];
  editedAt?: Date | null;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  clientId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReactionSchema = new Schema<Reaction>(
  {
    emoji: { type: String, required: true },
    userIds: [{ type: String }],
  },
  { _id: false },
);

const MessageSchema = new Schema<MessageDoc>(
  {
    workspaceId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    authorId: { type: String, required: true, index: true },
    body: { type: String, required: true, maxlength: CONTENT.MESSAGE_BODY_MAX },
    mentions: [{ type: String }],
    fileIds: [{ type: String }],
    parentId: { type: String, default: null, index: true },
    threadRootId: { type: String, default: null, index: true },
    replyCount: { type: Number, default: 0 },
    lastReplyAt: { type: Date, default: null },
    reactions: { type: [ReactionSchema], default: [] },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    clientId: { type: String, default: null, sparse: true, index: true },
  },
  { timestamps: true, collection: 'messages' },
);

MessageSchema.plugin(softDeletePlugin);

MessageSchema.index({ channelId: 1, threadRootId: 1, createdAt: -1 });
MessageSchema.index({ channelId: 1, createdAt: -1 });
MessageSchema.index({ body: 'text' });

export const MessageModel = mongoose.model<MessageDoc>('Message', MessageSchema);

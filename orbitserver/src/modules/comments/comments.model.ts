import { Schema, model, type Model } from 'mongoose';
import { CONTENT } from '@orbit/shared';
import {
  softDeletePlugin,
  type SoftDeleteFields,
  type SoftDeleteQueryHelpers,
  type SoftDeleteStatics,
} from '../../plugins/softDelete.js';

export type CommentEntityType = 'card' | 'page' | 'message';

export interface IComment extends SoftDeleteFields {
  workspaceId: string;
  entityType: CommentEntityType;
  entityId: string;
  authorId: string;
  body: string;
  mentions: string[];
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    workspaceId: { type: String, required: true },
    entityType: { type: String, required: true, enum: ['card', 'page', 'message'] },
    entityId: { type: String, required: true },
    authorId: { type: String, required: true },
    body: { type: String, required: true, maxlength: CONTENT.COMMENT_MAX },
    mentions: { type: [String], default: [] },
    editedAt: { type: Date, default: null },
  },
  { collection: 'comments', timestamps: true },
);

commentSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
commentSchema.index({ workspaceId: 1, authorId: 1, createdAt: -1 });
commentSchema.index({ mentions: 1, createdAt: -1 });
commentSchema.index({ body: 'text' });

softDeletePlugin(commentSchema);

export const CommentModel = model<
  IComment,
  Model<IComment, SoftDeleteQueryHelpers> & SoftDeleteStatics
>('Comment', commentSchema);

export function extractMentionHandles(body: string): string[] {
  const matches = body.match(/@[a-z0-9_]{3,30}/gi);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

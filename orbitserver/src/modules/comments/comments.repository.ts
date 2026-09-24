/**
 * Comments repository — unified collection across card/page/message.
 */
import type { ClientSession, Types } from 'mongoose';
import { clampLimit } from '@orbit/shared';
import { CommentModel, type IComment } from './comments.model.js';

export type CommentDoc = IComment & { _id: Types.ObjectId };

export async function createComment(
  data: Pick<IComment, 'workspaceId' | 'entityType' | 'entityId' | 'authorId' | 'body'> &
    Partial<IComment>,
  session?: ClientSession,
): Promise<CommentDoc> {
  const [comment] = await CommentModel.create([data], { session });
  return comment!.toObject();
}

export async function listComments(
  entityType: IComment['entityType'],
  entityId: string,
  limitRaw?: number,
): Promise<CommentDoc[]> {
  const limit = clampLimit(limitRaw ?? 100);
  return (
    (await CommentModel.find({ entityType, entityId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean<CommentDoc[]>()
      .exec()) ?? []
  );
}

export async function softDeleteComment(
  commentId: string,
  authorId: string,
  privileged: boolean,
): Promise<boolean> {
  const filter: Record<string, unknown> = { _id: commentId };
  if (!privileged) filter.authorId = authorId;
  const result = await CommentModel.findOneAndUpdate(
    filter,
    { $set: { deletedAt: new Date(), deletedBy: authorId } },
  ).exec();
  return result !== null;
}

/**
 * Chat repository (BUILD_PROMPT Phase 8).
 */
import type { ClientSession } from 'mongoose';
import { ChannelModel, type ChannelDoc } from './channels.model.js';
import { MessageModel, type MessageDoc } from './messages.model.js';
import { ChannelReadModel, type ChannelReadDoc } from './channelReads.model.js';

export async function findChannelById(id: string): Promise<ChannelDoc | null> {
  return ChannelModel.findOne({ _id: id, deletedAt: null }).exec();
}

export async function findChannelByIdScoped(id: string, workspaceId: string): Promise<ChannelDoc | null> {
  return ChannelModel.findOne({ _id: id, workspaceId, deletedAt: null }).exec();
}

export async function findChannelsByWorkspace(
  workspaceId: string,
  userId: string,
): Promise<ChannelDoc[]> {
  return ChannelModel.find({
    workspaceId,
    deletedAt: null,
    $or: [{ type: 'public' }, { memberIds: userId }],
  })
    .sort({ type: 1, name: 1 })
    .exec();
}

export async function createChannel(
  doc: Partial<ChannelDoc>,
  session?: ClientSession,
): Promise<ChannelDoc> {
  const [created] = await ChannelModel.create([doc], { session });
  return created!;
}

export async function updateChannelById(
  id: string,
  update: Partial<ChannelDoc>,
  session?: ClientSession,
): Promise<ChannelDoc | null> {
  return ChannelModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: update }, { new: true, session }).exec();
}

export async function findMessageById(id: string): Promise<MessageDoc | null> {
  return MessageModel.findOne({ _id: id, deletedAt: null }).exec();
}

export async function findMessageByClientId(clientId: string): Promise<MessageDoc | null> {
  return MessageModel.findOne({ clientId }).exec();
}

export async function findMessagesByChannel(
  channelId: string,
  limit = 50,
  beforeCreatedAt?: Date,
): Promise<MessageDoc[]> {
  const query: Record<string, unknown> = {
    channelId,
    threadRootId: null,
    deletedAt: null,
  };
  if (beforeCreatedAt) {
    query.createdAt = { $lt: beforeCreatedAt };
  }
  return MessageModel.find(query).sort({ createdAt: -1 }).limit(limit).exec();
}

export async function findThreadMessages(
  threadRootId: string,
  limit = 100,
): Promise<MessageDoc[]> {
  return MessageModel.find({
    $or: [{ _id: threadRootId }, { threadRootId }],
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .exec();
}

export async function createMessage(
  doc: Partial<MessageDoc>,
  session?: ClientSession,
): Promise<MessageDoc> {
  const [created] = await MessageModel.create([doc], { session });
  return created!;
}

export async function updateMessageById(
  id: string,
  update: Partial<MessageDoc>,
  session?: ClientSession,
): Promise<MessageDoc | null> {
  return MessageModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: update }, { new: true, session }).exec();
}

export async function updateChannelRead(
  workspaceId: string,
  channelId: string,
  userId: string,
  lastReadMessageId?: string,
): Promise<ChannelReadDoc | null> {
  return ChannelReadModel.findOneAndUpdate(
    { channelId, userId },
    {
      $set: {
        workspaceId,
        lastReadAt: new Date(),
        ...(lastReadMessageId ? { lastReadMessageId } : {}),
      },
    },
    { upsert: true, new: true },
  ).exec();
}

export async function findChannelReadsByUser(
  workspaceId: string,
  userId: string,
): Promise<ChannelReadDoc[]> {
  return ChannelReadModel.find({ workspaceId, userId }).exec();
}

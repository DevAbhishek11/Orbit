import { forbiddenScope, notFound } from '../../infrastructure/errors/ApiError.js';
import { runInTransaction } from '../../infrastructure/db/transaction.js';
import { emitSafe } from '../../infrastructure/events/eventBus.js';
import { enqueue } from '../../infrastructure/queues/index.js';
import * as repo from './chat.repository.js';
import type { ChannelDoc } from './channels.model.js';
import type { MessageDoc } from './messages.model.js';
import type { CreateChannelInput, SendMessageInput, UpdateChannelInput } from './chat.schema.js';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'channel'
  );
}

export async function createChannel(
  workspaceId: string,
  input: CreateChannelInput,
  actorId: string,
): Promise<ChannelDoc> {
  const memberIds = Array.from(new Set([actorId, ...(input.memberIds ?? [])]));
  let slug = slugify(input.name);

  if (input.type === 'dm') {
    const existing = await repo.findChannelsByWorkspace(workspaceId, actorId);
    const sortedMembers = [...memberIds].sort();
    const duplicate = existing.find(
      (c) =>
        c.type === 'dm' &&
        c.memberIds.length === sortedMembers.length &&
        [...c.memberIds].sort().every((id, idx) => id === sortedMembers[idx]),
    );
    if (duplicate) return duplicate;
    slug = `dm-${memberIds.slice(0, 2).join('-')}`;
  }

  return repo.createChannel({
    workspaceId,
    name: input.name,
    slug,
    type: input.type,
    topic: input.topic ?? '',
    memberIds,
    createdBy: actorId,
    messageCount: 0,
  });
}

export async function listChannels(
  workspaceId: string,
  userId: string,
): Promise<Array<Record<string, unknown> & { unread: boolean }>> {
  const channels = await repo.findChannelsByWorkspace(workspaceId, userId);
  const reads = await repo.findChannelReadsByUser(workspaceId, userId);
  const readMap = new Map(reads.map((r) => [r.channelId, r.lastReadAt]));

  return channels.map((c) => {
    const raw = c.toObject
      ? (c.toObject() as Record<string, unknown>)
      : (c as unknown as Record<string, unknown>);
    const lastRead = readMap.get(c._id.toString());
    const hasUnread =
      Boolean(c.lastMessage) &&
      (!lastRead || new Date(c.lastMessage!.at).getTime() > new Date(lastRead).getTime()) &&
      c.lastMessage!.authorId !== userId;
    return { ...raw, unread: hasUnread };
  });
}

export async function getChannel(channelId: string, workspaceId: string): Promise<ChannelDoc> {
  const channel = await repo.findChannelByIdScoped(channelId, workspaceId);
  if (!channel) throw notFound('Channel');
  return channel;
}

export async function updateChannel(
  channelId: string,
  workspaceId: string,
  input: UpdateChannelInput,
): Promise<ChannelDoc> {
  const updated = await repo.updateChannelById(channelId, {
    ...(input.name ? { name: input.name, slug: slugify(input.name) } : {}),
    ...(input.topic !== undefined ? { topic: input.topic } : {}),
  });
  if (!updated || updated.workspaceId !== workspaceId) throw notFound('Channel');
  return updated;
}

export async function deleteChannel(channelId: string, workspaceId: string): Promise<void> {
  const channel = await repo.findChannelByIdScoped(channelId, workspaceId);
  if (!channel) throw notFound('Channel');
  await repo.updateChannelById(channelId, { deletedAt: new Date() });
}

export async function sendMessage(
  channelId: string,
  workspaceId: string,
  input: SendMessageInput,
  authorId: string,
): Promise<MessageDoc> {
  if (input.clientId) {
    const existing = await repo.findMessageByClientId(input.clientId);
    if (existing) return existing;
  }

  const channel = await repo.findChannelByIdScoped(channelId, workspaceId);
  if (!channel) throw notFound('Channel');

  const message = await runInTransaction(async (tx) => {
    let threadRootId: string | null = null;
    let parentId: string | null = null;

    if (input.parentId) {
      const parent = await repo.findMessageById(input.parentId);
      if (!parent || parent.channelId !== channelId) throw notFound('Parent message');
      parentId = parent._id.toString();
      threadRootId = parent.threadRootId ?? parent._id.toString();

      await repo.updateMessageById(
        threadRootId,
        {
          $inc: { replyCount: 1 },
          lastReplyAt: new Date(),
        } as never,
        tx.session,
      );
    }

    const msg = await repo.createMessage(
      {
        workspaceId,
        channelId,
        authorId,
        body: input.body,
        clientId: input.clientId ?? null,
        parentId,
        threadRootId,
        mentions: [],
        fileIds: input.fileIds ?? [],
        reactions: [],
      },
      tx.session,
    );

    if (!threadRootId) {
      await repo.updateChannelById(
        channelId,
        {
          lastMessage: {
            _id: msg._id.toString(),
            authorId,
            preview: input.body.slice(0, 100),
            at: msg.createdAt,
          },
          $inc: { messageCount: 1 },
        } as never,
        tx.session,
      );
    }

    return msg;
  });

  try {
    if (message.threadRootId) {
      emitSafe(`channel:${channelId}`, 'thread:updated', {
        threadRootId: message.threadRootId,
        replyId: message._id.toString(),
      });
    } else {
      emitSafe(`channel:${channelId}`, 'message:new', {
        message: {
          id: message._id.toString(),
          body: message.body,
          authorId: message.authorId,
          channelId: message.channelId,
        },
        clientId: message.clientId,
      });
    }

    void enqueue('notifications', 'fan-out', {
      type: 'message:new',
      workspaceId,
      channelId,
      messageId: message._id.toString(),
      authorId,
    });

    void enqueue('search-index', 'reindex-entity', {
      entityType: 'message',
      entityId: message._id.toString(),
      workspaceId,
    });
  } catch {}

  return message;
}

export async function listMessages(
  channelId: string,
  workspaceId: string,
  limit = 50,
  before?: string,
): Promise<MessageDoc[]> {
  const channel = await repo.findChannelByIdScoped(channelId, workspaceId);
  if (!channel) throw notFound('Channel');
  const beforeDate = before ? new Date(before) : undefined;
  const messages = await repo.findMessagesByChannel(channelId, limit, beforeDate);
  return messages.reverse();
}

export async function getThread(
  messageId: string,
  workspaceId: string,
): Promise<{ root: MessageDoc; replies: MessageDoc[] }> {
  const root = await repo.findMessageById(messageId);
  if (!root || root.workspaceId !== workspaceId) throw notFound('Message');
  const all = await repo.findThreadMessages(root._id.toString(), 100);
  const replies = all.filter((m) => m._id.toString() !== root._id.toString());
  return { root, replies };
}

export async function toggleReaction(
  messageId: string,
  workspaceId: string,
  emoji: string,
  userId: string,
): Promise<MessageDoc> {
  const message = await repo.findMessageById(messageId);
  if (!message || message.workspaceId !== workspaceId) throw notFound('Message');

  const reactions = message.reactions ?? [];
  const existingIndex = reactions.findIndex((r) => r.emoji === emoji);

  if (existingIndex >= 0) {
    const rx = reactions[existingIndex]!;
    if (rx.userIds.includes(userId)) {
      rx.userIds = rx.userIds.filter((id) => id !== userId);
    } else {
      rx.userIds.push(userId);
    }
  } else {
    reactions.push({ emoji, userIds: [userId] });
  }

  const cleaned = reactions.filter((r) => r.userIds.length > 0);
  const updated = await repo.updateMessageById(messageId, { reactions: cleaned });
  return updated!;
}

export async function editMessage(
  messageId: string,
  workspaceId: string,
  body: string,
  userId: string,
): Promise<MessageDoc> {
  const message = await repo.findMessageById(messageId);
  if (!message || message.workspaceId !== workspaceId) throw notFound('Message');
  if (message.authorId !== userId) throw forbiddenScope('You can only edit your own messages');

  const updated = await repo.updateMessageById(messageId, {
    body,
    editedAt: new Date(),
  });
  return updated!;
}

export async function deleteMessage(
  messageId: string,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const message = await repo.findMessageById(messageId);
  if (!message || message.workspaceId !== workspaceId) throw notFound('Message');
  if (message.authorId !== userId) throw forbiddenScope('You can only delete your own messages');

  await repo.updateMessageById(messageId, {
    body: '[Message deleted]',
    deletedAt: new Date(),
    deletedBy: userId,
  });
}

export async function markChannelRead(
  channelId: string,
  workspaceId: string,
  userId: string,
  messageId?: string,
): Promise<void> {
  await repo.updateChannelRead(workspaceId, channelId, userId, messageId);
}

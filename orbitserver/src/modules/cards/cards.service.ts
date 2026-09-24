/**
 * Cards service (BUILD_PROMPT Phase 6) — the Trello pillar's core.
 *
 * T2 (card move) runs INSIDE one transaction:
 *   card (version-guarded) + source/target list counters + activity + audit.
 * AFTER commit (never inside): cache invalidation, socket emit, notification
 * job. Stale versions answer 409 VERSION_CONFLICT WITH the current card.
 * Exhausted order keys answer 409 ORDER_KEY_EXHAUSTED + enqueue rebalance.
 */
import { nanoid } from 'nanoid';
import { firstKey, incrementKey, keyBetween, evenKeys } from '@orbit/shared';
import { runInTransaction } from '../../infrastructure/db/transaction.js';
import { invalidateTag } from '../../infrastructure/cache/cacheService.js';
import {
  ApiError,
  badRequest,
  notFound,
  orderKeyExhausted,
} from '../../infrastructure/errors/ApiError.js';
import { emitSafe } from '../../infrastructure/events/eventBus.js';
import { enqueue } from '../../infrastructure/queues/index.js';
import { childLogger } from '../../infrastructure/logger/index.js';
import { createActivity, listEntityActivity } from '../activities/activities.repository.js';
import { recordAudit } from '../audit/audit.service.js';
import { extractMentionHandles } from '../comments/comments.model.js';
import { createComment, listComments } from '../comments/comments.repository.js';
import { findBoardByIdScoped, findListById, incBoardStats, incListCardCount } from '../boards/boards.repository.js';
import { findUsersByHandles } from '../users/users.repository.js';
import { computeChecklistProgress, CardModel } from './cards.model.js';
import {
  createCard,
  findCardByIdScoped,
  findCardByIdIncludingDeleted,
  getLastCardOrder,
  findNeighborCards,
  incCardCommentCount,
  listCards,
  restoreCard,
  softDeleteCard,
  updateCardWithVersionGuard,
  type CardDoc,
  type CardFilters,
} from './cards.repository.js';
import type { Actor } from '../boards/boards.service.js';
import type {
  CommentInput,
  CreateCardInput,
  CreateCardFromMessageInput,
  ListCardsQuery,
  MoveCardInput,
  UpdateCardInput,
} from '../boards/boards.schema.js';

const log = childLogger({ module: 'cards' });

export function serializeCard(card: CardDoc): Record<string, unknown> {
  const { _id, ...rest } = card as unknown as Record<string, unknown> & { _id: unknown };
  return { ...rest, id: String(_id) };
}

async function loadCardOr404(cardId: string, workspaceId: string): Promise<CardDoc> {
  const card = await findCardByIdScoped(cardId, workspaceId);
  if (!card) throw notFound('Card'); // cross-tenant → 404, never 403
  return card;
}

// ── create ────────────────────────────────────────────────────────────

export async function createCardInList(
  listId: string,
  workspaceId: string,
  input: CreateCardInput,
  actor: Actor,
): Promise<Record<string, unknown>> {
  const list = await findListById(listId);
  if (!list || list.workspaceId !== workspaceId) throw notFound('List');
  const board = await findBoardByIdScoped(list.boardId, workspaceId);
  if (!board) throw notFound('Board');

  const order = await computeInsertOrder(listId, input.beforeCardId ?? null);
  const checklists = (input.checklists ?? []).map((c) => ({
    ...c,
    id: c.id || nanoid(8),
    items: c.items.map((i) => ({ ...i, id: i.id || nanoid(8) })),
  }));

  const card = await runInTransaction(
    async (tx) => {
      const created = await createCard(
        {
          workspaceId,
          boardId: list.boardId,
          listId,
          title: input.title,
          description: input.description,
          order,
          labels: input.labels ?? [],
          checklists,
          assignees: input.assignees ?? [],
          dueAt: input.dueAt ?? null,
          startAt: input.startAt ?? null,
          priority: input.priority ?? 'none',
          coverColor: input.coverColor ?? undefined,
          sourceMessageId: input.sourceMessageId ?? null,
          pageId: input.pageId ?? null,
          checklistProgress: computeChecklistProgress({ checklists }),
          createdBy: actor.userId,
          watcherIds: [actor.userId],
        },
        tx.session,
      );
      await incListCardCount(listId, 1, tx.session);
      await incBoardStats(list.boardId, { cardCount: 1 }, tx.session);
      await createActivity(
        { workspaceId, entityType: 'card', entityId: String(created._id), actorId: actor.userId, action: 'created', meta: { listId, title: created.title } },
        tx.session,
      );
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'card.create',
        entityType: 'card',
        entityId: String(created._id),
        workspaceId,
        after: { title: created.title, listId, boardId: list.boardId },
        session: tx.session,
      });
      return created;
    },
    { name: 'create-card' },
  );

  await afterCommit(list.boardId, card, 'card:created', input.clientMutationId, actor);
  return serializeCard(card);
}

async function computeInsertOrder(listId: string, beforeCardId: string | null): Promise<string> {
  if (!beforeCardId) {
    const last = await getLastCardOrder(listId);
    return last === null ? firstKey() : incrementKey(last);
  }
  const anchor = await findNeighborCards(listId, undefined, beforeCardId);
  const next = anchor.after;
  if (!next) throw badRequest('beforeCardId not found in this list');
  const below = await findPrecedingCard(listId, next.order);
  try {
    return keyBetween(below?.order ?? null, next.order);
  } catch (err) {
    if ((err as Error).message.includes('exhausted')) {
      await enqueue('cleanup', 'rebalance-list', { listId }, { dedupeKey: `rebalance:${listId}` });
      throw orderKeyExhausted();
    }
    throw err;
  }
}

async function findPrecedingCard(listId: string, order: string): Promise<CardDoc | null> {
  return (
    (await CardModel.findOne({ listId, order: { $lt: order }, archivedAt: null })
      .sort({ order: -1 })
      .lean<CardDoc>()
      .exec()) ?? null
  );
}

async function afterCommit(
  boardId: string,
  card: CardDoc,
  event: string,
  clientMutationId: string | undefined,
  actor: Actor,
): Promise<void> {
  await invalidateTag(`board:${boardId}`);
  emitSafe(`board:${boardId}`, event, {
    card: serializeCard(card),
    boardId,
    clientMutationId,
    actorId: actor.userId,
  });
}

// ── read ──────────────────────────────────────────────────────────────

export async function getCardDetails(cardId: string, workspaceId: string): Promise<Record<string, unknown>> {
  const card = await loadCardOr404(cardId, workspaceId);
  const assignees = await import('../users/users.repository.js').then((r) => r.findUsersByIds(card.assignees));
  return {
    ...serializeCard(card),
    assigneeProfiles: assignees.map((u) => ({
      id: String(u._id),
      name: u.name,
      handle: u.handle,
      avatarUrl: u.avatarUrl ?? null,
    })),
  };
}

export async function listBoardCards(
  boardId: string,
  workspaceId: string,
  query: ListCardsQuery,
): Promise<{ cards: unknown[]; nextCursor: string | null }> {
  const board = await findBoardByIdScoped(boardId, workspaceId);
  if (!board) throw notFound('Board');
  const filters: CardFilters = { boardId, ...query };
  const result = await listCards(workspaceId, filters, {
    limit: query.limit,
    cursor: query.cursor,
  });
  return { cards: result.cards.map(serializeCard), nextCursor: result.nextCursor };
}

export async function getCardActivity(cardId: string, workspaceId: string, query: { limit?: number; cursor?: string }): Promise<unknown> {
  await loadCardOr404(cardId, workspaceId);
  return listEntityActivity('card', cardId, query);
}

export async function getCardComments(cardId: string, workspaceId: string): Promise<unknown[]> {
  await loadCardOr404(cardId, workspaceId);
  const comments = await listComments('card', cardId);
  return comments.map((c) => ({ ...c, id: String(c._id) }));
}

// ── update ────────────────────────────────────────────────────────────

export async function updateCardDetails(
  cardId: string,
  workspaceId: string,
  input: UpdateCardInput,
  actor: Actor,
): Promise<Record<string, unknown>> {
  const card = await loadCardOr404(cardId, workspaceId);
  if (card.version !== input.version) throw versionConflict(card);

  const update: Record<string, unknown> = {};
  for (const key of ['title', 'description', 'labels', 'assignees', 'dueAt', 'startAt', 'priority', 'coverColor'] as const) {
    if (input[key] !== undefined) update[key] = input[key];
  }
  if (input.checklists !== undefined) {
    update.checklists = input.checklists;
    update.checklistProgress = computeChecklistProgress({ checklists: input.checklists });
  }
  if (input.completed !== undefined) {
    update.completedAt = input.completed ? new Date() : null;
  }
  if (input.archivedAt !== undefined) {
    update.archivedAt = input.archivedAt ? new Date() : null;
  }

  const updated = await runInTransaction(
    async (tx) => {
      const result = await updateCardWithVersionGuard(cardId, input.version, update, tx.session);
      if (!result) {
        // Concurrent writer won between our read and the guarded update.
        const current = await findCardByIdScoped(cardId, workspaceId);
        throw current ? versionConflict(current) : notFound('Card');
      }
      await createActivity(
        { workspaceId, entityType: 'card', entityId: cardId, actorId: actor.userId, action: 'updated', meta: { fields: Object.keys(update) } },
        tx.session,
      );
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'card.update',
        entityType: 'card',
        entityId: cardId,
        workspaceId,
        before: pickChanged(card, update),
        after: update,
        session: tx.session,
      });
      return result;
    },
    { name: 'update-card' },
  );

  await invalidateTag(`board:${card.boardId}`);
  emitSafe(`board:${card.boardId}`, 'card:updated', {
    card: serializeCard(updated),
    boardId: card.boardId,
    actorId: actor.userId,
  });
  if (input.assignees) {
    await enqueue('notifications', 'card-assigned', {
      cardId,
      workspaceId,
      assignees: input.assignees,
      actorId: actor.userId,
    });
  }
  return serializeCard(updated);
}

function pickChanged(card: CardDoc, update: Record<string, unknown>): Record<string, unknown> {
  const before: Record<string, unknown> = {};
  for (const key of Object.keys(update)) {
    before[key] = (card as unknown as Record<string, unknown>)[key];
  }
  return before;
}

function versionConflict(current: CardDoc): ApiError {
  return new ApiError('VERSION_CONFLICT', 'This card was modified by someone else — reload and retry', {
    details: { current: serializeCard(current), currentVersion: current.version },
  });
}

// ── T2: transactional move ────────────────────────────────────────────

export async function moveCard(
  cardId: string,
  workspaceId: string,
  input: MoveCardInput,
  actor: Actor,
): Promise<Record<string, unknown>> {
  const card = await loadCardOr404(cardId, workspaceId);
  if (card.version !== input.version) throw versionConflict(card);

  const targetList = await findListById(input.targetListId);
  if (!targetList || targetList.workspaceId !== workspaceId) throw notFound('List');

  const crossBoard = targetList.boardId !== card.boardId;
  if (crossBoard) {
    const targetBoard = await findBoardByIdScoped(targetList.boardId, workspaceId);
    if (!targetBoard) throw notFound('Board');
    if (targetBoard.visibility === 'private' && !['owner', 'admin'].includes(actor.role) && targetBoard.createdBy !== actor.userId && !targetBoard.memberIds.includes(actor.userId)) throw notFound('Board');
  }

  // Neighbours must live in the TARGET list.
  const neighbors = await findNeighborCards(
    String(targetList._id),
    input.beforeCardId ?? undefined,
    input.afterCardId ?? undefined,
  );
  if (input.beforeCardId && !neighbors.before) throw badRequest('beforeCardId not found in the target list');
  if (input.afterCardId && !neighbors.after) throw badRequest('afterCardId not found in the target list');

  const prevOrder = neighbors.before?.order ?? (await precedingOrderInTarget(String(targetList._id), input.afterCardId ? neighbors.after!.order : null, cardId));
  const nextOrder = neighbors.after?.order ?? null;
  if (prevOrder && nextOrder && prevOrder >= nextOrder) {
    throw new ApiError('ORDER_CONFLICT', 'Neighbour hints are contradictory', {
      details: { prevOrder, nextOrder },
    });
  }

  let order: string;
  try {
    order = keyBetween(prevOrder, nextOrder);
  } catch (err) {
    if ((err as Error).message.includes('exhausted')) {
      await enqueue('cleanup', 'rebalance-list', { listId: String(targetList._id) }, {
        dedupeKey: `rebalance:${String(targetList._id)}`,
      });
      throw orderKeyExhausted();
    }
    if ((err as Error).message.includes('out of order')) {
      throw new ApiError('ORDER_CONFLICT', 'Neighbour hints are contradictory');
    }
    throw err;
  }

  const sourceListId = card.listId;
  const sourceBoardId = card.boardId;
  const changedList = sourceListId !== String(targetList._id);

  const moved = await runInTransaction(
    async (tx) => {
      const result = await updateCardWithVersionGuard(
        cardId,
        input.version,
        { listId: String(targetList._id), boardId: targetList.boardId, order },
        tx.session,
      );
      if (!result) {
        const current = await findCardByIdScoped(cardId, workspaceId);
        throw current ? versionConflict(current) : notFound('Card');
      }
      if (changedList) {
        await incListCardCount(sourceListId, -1, tx.session);
        await incListCardCount(String(targetList._id), 1, tx.session);
      }
      if (crossBoard) {
        await incBoardStats(sourceBoardId, { cardCount: -1 }, tx.session);
        await incBoardStats(targetList.boardId, { cardCount: 1 }, tx.session);
      }
      await createActivity(
        {
          workspaceId,
          entityType: 'card',
          entityId: cardId,
          actorId: actor.userId,
          action: 'moved',
          meta: { fromListId: sourceListId, toListId: String(targetList._id), order },
        },
        tx.session,
      );
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'card.move',
        entityType: 'card',
        entityId: cardId,
        workspaceId,
        before: { listId: sourceListId, boardId: sourceBoardId, order: card.order },
        after: { listId: String(targetList._id), boardId: targetList.boardId, order },
        session: tx.session,
      });
      return result;
    },
    { name: 'T2-card-move' },
  );

  // AFTER commit — cache, sockets, notifications. Never inside the tx.
  await invalidateTag(`board:${sourceBoardId}`);
  if (crossBoard) await invalidateTag(`board:${targetList.boardId}`);
  emitSafe(`board:${sourceBoardId}`, 'card:moved', {
    card: serializeCard(moved),
    boardId: sourceBoardId,
    fromListId: sourceListId,
    toListId: String(targetList._id),
    clientMutationId: input.clientMutationId,
    actorId: actor.userId,
  });
  await enqueue('notifications', 'card-moved', {
    cardId,
    workspaceId,
    watchers: moved.watcherIds,
    actorId: actor.userId,
  });
  return serializeCard(moved);
}

/** When only afterCardId is given, find the card that precedes it (skipping the moving card). */
async function precedingOrderInTarget(
  targetListId: string,
  afterOrder: string | null,
  movingCardId: string,
): Promise<string | null> {
  const filter: Record<string, unknown> = {
    listId: targetListId,
    archivedAt: null,
    _id: { $ne: movingCardId },
  };
  if (afterOrder) filter.order = { $lt: afterOrder };
  const card = await CardModel.findOne(filter).sort({ order: -1 }).lean<CardDoc>().exec();
  return card?.order ?? null;
}

// ── delete / restore ──────────────────────────────────────────────────

export async function deleteCardSoft(cardId: string, workspaceId: string, actor: Actor): Promise<void> {
  const card = await loadCardOr404(cardId, workspaceId);
  await runInTransaction(
    async (tx) => {
      await softDeleteCard(cardId, actor.userId, tx.session);
      await incListCardCount(card.listId, -1, tx.session);
      await incBoardStats(card.boardId, { cardCount: -1 }, tx.session);
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'card.delete',
        entityType: 'card',
        entityId: cardId,
        workspaceId,
        before: { title: card.title, listId: card.listId },
        session: tx.session,
      });
    },
    { name: 'delete-card' },
  );
  await invalidateTag(`board:${card.boardId}`);
  emitSafe(`board:${card.boardId}`, 'card:deleted', { cardId, boardId: card.boardId, actorId: actor.userId });
}

export async function restoreSoftDeletedCard(cardId: string, workspaceId: string, actor: Actor): Promise<Record<string, unknown>> {
  // Tenant check BEFORE the write — a cross-tenant id must answer 404 without
  // touching the document (rule 6: no cross-tenant writes, no enumeration).
  const existing = await findCardByIdIncludingDeleted(cardId);
  if (!existing || existing.workspaceId !== workspaceId) throw notFound('Card');

  const card = await restoreCard(cardId);
  if (!card) throw notFound('Card');
  await runInTransaction(
    async (tx) => {
      await incListCardCount(card.listId, 1, tx.session);
      await incBoardStats(card.boardId, { cardCount: 1 }, tx.session);
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'card.restore',
        entityType: 'card',
        entityId: cardId,
        workspaceId,
        session: tx.session,
      });
    },
    { name: 'restore-card' },
  );
  await invalidateTag(`board:${card.boardId}`);
  emitSafe(`board:${card.boardId}`, 'card:created', { card: serializeCard(card), boardId: card.boardId, restored: true });
  return serializeCard(card);
}

/** Rebalance a list's order keys (weekly job + ORDER_KEY_EXHAUSTED remedy). */
export async function rebalanceListOrder(listId: string, workspaceId: string): Promise<{ count: number }> {
  const list = await findListById(listId);
  if (!list || list.workspaceId !== workspaceId) throw notFound('List');
  const cards = await CardModel.find({ listId, archivedAt: null })
    .sort({ order: 1 })
    .lean<CardDoc[]>()
    .exec();
  if (cards.length === 0) return { count: 0 };

  const keys = evenKeys(cards.length);
  await runInTransaction(
    async (tx) => {
      await CardModel.bulkWrite(
        cards.map((c, i) => ({
          updateOne: { filter: { _id: c._id }, update: { $set: { order: keys[i]! } } },
        })),
        tx.session ? { session: tx.session } : undefined,
      );
    },
    { name: 'rebalance-list' },
  );
  await invalidateTag(`board:${list.boardId}`);
  emitSafe(`board:${list.boardId}`, 'list:rebalanced', { listId, boardId: list.boardId });
  log.info({ listId, count: cards.length }, 'list order keys rebalanced');
  return { count: cards.length };
}

// ── C1 + T3 — create card from message (cross-pillar transaction) ──────

export async function createCardFromMessage(
  workspaceId: string,
  input: CreateCardFromMessageInput,
  actor: Actor,
): Promise<Record<string, unknown>> {
  // Load source message
  const { findMessageById } = await import('../chat/chat.repository.js');
  const message = await findMessageById(input.messageId);
  if (!message || message.workspaceId !== workspaceId) throw notFound('Message');

  const board = await findBoardByIdScoped(input.boardId, workspaceId);
  if (!board) throw notFound('Board');

  let targetListId = input.listId;
  if (!targetListId) {
    // Use first list of board as default
    const { findListsByBoard } = await import('../boards/boards.repository.js');
    const lists = await findListsByBoard(input.boardId);
    if (lists.length === 0) throw notFound('List — board has no lists');
    targetListId = String(lists[0]!._id);
  }

  const list = await findListById(targetListId);
  if (!list || list.workspaceId !== workspaceId || list.boardId !== input.boardId) throw notFound('List');

  const title = input.title?.trim() || message.body.slice(0, 100) || 'Card from message';
  const order = await computeInsertOrder(targetListId, null);

  const card = await runInTransaction(
    async (tx) => {
      const created = await createCard(
        {
          workspaceId,
          boardId: input.boardId,
          listId: targetListId,
          title,
          description: `Created from message in #${message.channelId}:\n\n> ${message.body}`,
          order,
          sourceMessageId: input.messageId,
          createdBy: actor.userId,
          checklistProgress: { done: 0, total: 0 },
        },
        tx.session,
      );

      await incListCardCount(targetListId, 1, tx.session);
      await incBoardStats(input.boardId, { cardCount: 1 }, tx.session);

      await createActivity(
        {
          workspaceId,
          entityType: 'card',
          entityId: String(created._id),
          actorId: actor.userId,
          action: 'created_from_message',
          meta: { messageId: input.messageId, channelId: message.channelId },
        },
        tx.session,
      );

      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'card.create_from_message',
        entityType: 'card',
        entityId: String(created._id),
        workspaceId,
        after: { title, sourceMessageId: input.messageId },
        session: tx.session,
      });

      // Post thread reply in source channel with card permalink
      const { createMessage, updateMessageById } = await import('../chat/chat.repository.js');
      const reply = await createMessage(
        {
          workspaceId,
          channelId: message.channelId,
          authorId: actor.userId,
          body: `📌 Created card [${title}](/boards/${input.boardId}?card=${String(created._id)}) from this message`,
          parentId: message._id.toString(),
          threadRootId: message.threadRootId ?? message._id.toString(),
        },
        tx.session,
      );

      // Bump replyCount on root
      const rootId = message.threadRootId ?? message._id.toString();
      await updateMessageById(
        rootId,
        { $inc: { replyCount: 1 }, lastReplyAt: new Date() } as never,
        tx.session,
      );

      void reply;

      return created;
    },
    { name: 'card-from-message' },
  );

  await invalidateTag(`board:${input.boardId}`);

  try {
    emitSafe(`board:${input.boardId}`, 'card:created', {
      card: serializeCard(card),
      boardId: input.boardId,
      sourceMessageId: input.messageId,
    });
    emitSafe(`channel:${message.channelId}`, 'thread:updated', {
      threadRootId: message.threadRootId ?? message._id.toString(),
      cardId: String(card._id),
    });
    void enqueue('notifications', 'card-from-message', {
      cardId: String(card._id),
      workspaceId,
      channelId: message.channelId,
      messageId: input.messageId,
      actorId: actor.userId,
    });
  } catch {
    // ignore
  }

  return serializeCard(card);
}

// ── comments (unified collection) ─────────────────────────────────────

export async function addCardComment(
  cardId: string,
  workspaceId: string,
  input: CommentInput,
  actor: Actor,
): Promise<Record<string, unknown>> {
  const card = await loadCardOr404(cardId, workspaceId);
  const handles = extractMentionHandles(input.body);
  const mentioned = handles.length > 0 ? await findUsersByHandles(handles) : [];
  const mentionIds = mentioned.map((u) => String(u._id));

  const comment = await runInTransaction(
    async (tx) => {
      const created = await createComment(
        {
          workspaceId,
          entityType: 'card',
          entityId: cardId,
          authorId: actor.userId,
          body: input.body,
          mentions: mentionIds,
        },
        tx.session,
      );
      await incCardCommentCount(cardId, 1, tx.session);
      await createActivity(
        { workspaceId, entityType: 'card', entityId: cardId, actorId: actor.userId, action: 'commented' },
        tx.session,
      );
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'card.comment',
        entityType: 'card',
        entityId: cardId,
        workspaceId,
        after: { commentId: String(created._id) },
        session: tx.session,
      });
      return created;
    },
    { name: 'card-comment' },
  );

  emitSafe(`board:${card.boardId}`, 'comment:new', {
    cardId,
    boardId: card.boardId,
    comment: { id: String(comment._id), body: comment.body, authorId: comment.authorId, createdAt: comment.createdAt },
    clientMutationId: input.clientMutationId,
    actorId: actor.userId,
  });
  const recipients = new Set([...card.watcherIds, ...card.assignees, ...mentionIds]);
  recipients.delete(actor.userId); // never notify the actor
  if (recipients.size > 0) {
    await enqueue('notifications', 'card-comment', {
      cardId,
      workspaceId,
      recipients: [...recipients],
      actorId: actor.userId,
      commentId: String(comment._id),
    });
  }
  return { id: String(comment._id), body: comment.body, authorId: comment.authorId, mentions: comment.mentions, createdAt: comment.createdAt };
}

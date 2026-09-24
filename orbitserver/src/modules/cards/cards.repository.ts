/**
 * Cards repository — the only place with card queries (rule 1).
 * Every fetch is workspace-scoped; ordering uses the {listId, order} index.
 */
import type { ClientSession, FilterQuery, Types } from 'mongoose';
import { buildSeekFilter, clampLimit, decodeCursor, encodeCursor } from '@orbit/shared';
import { CardModel, type ICard } from './cards.model.js';

export type CardDoc = ICard & { _id: Types.ObjectId };

export async function createCard(
  data: Pick<ICard, 'workspaceId' | 'boardId' | 'listId' | 'title' | 'order' | 'createdBy'> &
    Partial<ICard>,
  session?: ClientSession,
): Promise<CardDoc> {
  const [card] = await CardModel.create([data], { session });
  return card!.toObject();
}

export async function findCardById(id: string, session?: ClientSession): Promise<CardDoc | null> {
  const q = CardModel.findOne({ _id: id });
  return ((session ? q.session(session) : q).lean<CardDoc>().exec()) ?? null;
}

/**
 * Trash lookup: finds a card even when it is soft-deleted.
 * Used by the restore route, whose authorize() loader must be able to SEE the
 * deleted document (the default query scope hides it, which made
 * POST /cards/:id/restore unreachable — a deleted card always answered 404).
 */
export async function findCardByIdIncludingDeleted(
  id: string,
  session?: ClientSession,
): Promise<CardDoc | null> {
  const q = CardModel.findOne({ _id: id }).withDeleted();
  const scoped = session ? q.session(session) : q;
  return (await scoped.lean<CardDoc>().exec()) ?? null;
}

/** Tenant guard baked into the query — cross-tenant reads answer null → 404. */
export async function findCardByIdScoped(
  id: string,
  workspaceId: string,
  session?: ClientSession,
): Promise<CardDoc | null> {
  const q = CardModel.findOne({ _id: id, workspaceId });
  return ((session ? q.session(session) : q).lean<CardDoc>().exec()) ?? null;
}

export async function getLastCardOrder(listId: string, session?: ClientSession): Promise<string | null> {
  const q = CardModel.findOne({ listId, archivedAt: null }).sort({ order: -1 }).select('order');
  const card = await (session ? q.session(session) : q).lean<{ order: string }>().exec();
  return card?.order ?? null;
}

export async function findNeighborCards(
  listId: string,
  beforeId?: string,
  afterId?: string,
  session?: ClientSession,
): Promise<{ before: CardDoc | null; after: CardDoc | null }> {
  const load = async (id: string | undefined): Promise<CardDoc | null> => {
    if (!id) return null;
    const q = CardModel.findOne({ _id: id, listId, archivedAt: null });
    return ((session ? q.session(session) : q).lean<CardDoc>().exec()) ?? null;
  };
  const [before, after] = await Promise.all([load(beforeId), load(afterId)]);
  return { before, after };
}

export interface CardFilters {
  boardId: string;
  listId?: string;
  assignee?: string;
  label?: string;
  due?: 'overdue' | 'today' | 'week';
  q?: string;
  completed?: boolean;
  includeArchived?: boolean;
}

function buildCardFilter(workspaceId: string, filters: CardFilters): FilterQuery<ICard> {
  const filter: FilterQuery<ICard> = {
    workspaceId,
    boardId: filters.boardId,
  };
  if (!filters.includeArchived) filter.archivedAt = null;
  if (filters.listId) filter.listId = filters.listId;
  if (filters.assignee) filter.assignees = filters.assignee;
  if (filters.label) filter['labels.id'] = filters.label;
  if (filters.completed === true) filter.completedAt = { $ne: null };
  if (filters.completed === false) filter.completedAt = null;

  if (filters.due) {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    if (filters.due === 'overdue') {
      filter.dueAt = { $lt: now, $ne: null };
      filter.completedAt = null;
    } else if (filters.due === 'today') {
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      filter.dueAt = { $gte: startOfToday, $lte: endOfToday };
    } else if (filters.due === 'week') {
      const weekEnd = new Date(endOfToday.getTime() + 7 * 86_400_000);
      filter.dueAt = { $gte: now, $lte: weekEnd };
    }
  }
  if (filters.q) {
    filter.$text = { $search: filters.q };
  }
  return filter;
}

export interface ListCardsResult {
  cards: CardDoc[];
  nextCursor: string | null;
}

/**
 * Cursor-paginated card listing (never skip). Sort: list order for board
 * render, updatedAt for feeds. Uses {listId, order} / {boardId, ...} indexes.
 */
export async function listCards(
  workspaceId: string,
  filters: CardFilters,
  pagination: { limit?: number; cursor?: string; sortByListOrder?: boolean } = {},
): Promise<ListCardsResult> {
  const limit = clampLimit(pagination.limit);
  const filter = buildCardFilter(workspaceId, filters);

  const cursorPayload = pagination.cursor ? decodeCursor(pagination.cursor) : null;
  if (pagination.sortByListOrder !== false) {
    if (cursorPayload) Object.assign(filter, buildSeekFilter('order', 1, cursorPayload));
    const rows = await CardModel.find(filter)
      .sort({ order: 1, _id: 1 })
      .limit(limit + 1)
      .lean<CardDoc[]>()
      .exec();
    return pageResult(rows, limit, (c) => c.order);
  }

  if (cursorPayload) Object.assign(filter, buildSeekFilter('updatedAt', -1, cursorPayload));
  const rows = await CardModel.find(filter)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean<CardDoc[]>()
    .exec();
  return pageResult(rows, limit, (c) => c.updatedAt.toISOString());
}

function pageResult(
  rows: CardDoc[],
  limit: number,
  sortValueOf: (card: CardDoc) => string,
): ListCardsResult {
  const hasMore = rows.length > limit;
  const cards = hasMore ? rows.slice(0, limit) : rows;
  const last = cards[cards.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ v: sortValueOf(last), i: String(last._id) }) : null;
  return { cards, nextCursor };
}

export async function updateCardWithVersionGuard(
  cardId: string,
  expectedVersion: number,
  update: Record<string, unknown>,
  session?: ClientSession,
): Promise<CardDoc | null> {
  const q = CardModel.findOneAndUpdate(
    { _id: cardId, version: expectedVersion },
    { $set: { ...update, version: expectedVersion + 1 } },
    { new: true },
  );
  return ((session ? q.session(session) : q).lean<CardDoc>().exec()) ?? null;
}

export async function updateCard(
  cardId: string,
  update: Record<string, unknown>,
  session?: ClientSession,
): Promise<CardDoc | null> {
  const q = CardModel.findOneAndUpdate({ _id: cardId }, { $set: update }, { new: true });
  return ((session ? q.session(session) : q).lean<CardDoc>().exec()) ?? null;
}

export async function incCardCommentCount(cardId: string, delta: number, session?: ClientSession): Promise<void> {
  await CardModel.updateOne({ _id: cardId }, { $inc: { commentCount: delta } }, { session }).exec();
}

export async function softDeleteCard(cardId: string, actorId: string, session?: ClientSession): Promise<boolean> {
  const result = await CardModel.findOneAndUpdate(
    { _id: cardId },
    { $set: { deletedAt: new Date(), deletedBy: actorId } },
    session ? { session } : {},
  ).exec();
  return result !== null;
}

export async function restoreCard(cardId: string): Promise<CardDoc | null> {
  return (
    (await CardModel.restore({ _id: cardId }).lean<CardDoc>().exec()) ?? null
  );
}

/** Prune a removed member from every card assignment in the workspace (T4). */
export async function pruneAssignee(workspaceId: string, userId: string, session?: ClientSession): Promise<number> {
  const result = await CardModel.updateMany(
    { workspaceId, assignees: userId },
    { $pull: { assignees: userId } },
    session ? { session } : undefined,
  ).exec();
  return result.modifiedCount;
}

export async function countCardsInList(listId: string, session?: ClientSession): Promise<number> {
  return CardModel.countDocuments({ listId, archivedAt: null }, session ? { session } : {}).exec();
}

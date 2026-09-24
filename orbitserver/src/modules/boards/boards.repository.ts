/**
 * Boards & lists repository — every query workspace-scoped (rule 6).
 */
import type { ClientSession, Types } from 'mongoose';
import { BoardModel, type IBoard } from './boards.model.js';
import { ListModel, type IList } from './lists.model.js';

export type BoardDoc = IBoard & { _id: Types.ObjectId };
export type ListDoc = IList & { _id: Types.ObjectId };

// ── Boards ────────────────────────────────────────────────────────────

export async function createBoard(
  data: Pick<IBoard, 'workspaceId' | 'name' | 'createdBy'> & Partial<IBoard>,
  session?: ClientSession,
): Promise<BoardDoc> {
  const [board] = await BoardModel.create([data], { session });
  return board!.toObject();
}

export async function findBoardById(
  id: string,
  session?: ClientSession,
): Promise<BoardDoc | null> {
  const q = BoardModel.findOne({ _id: id });
  return ((session ? q.session(session) : q).lean<BoardDoc>().exec()) ?? null;
}

/** Workspace-scoped fetch — a foreign board id answers null (→ 404 upstream). */
export async function findBoardByIdScoped(
  id: string,
  workspaceId: string,
  session?: ClientSession,
): Promise<BoardDoc | null> {
  const q = BoardModel.findOne({ _id: id, workspaceId });
  return ((session ? q.session(session) : q).lean<BoardDoc>().exec()) ?? null;
}

export async function listBoards(
  workspaceId: string,
  options: { includeArchived?: boolean; userId?: string } = {},
): Promise<BoardDoc[]> {
  const filter: Record<string, unknown> = { workspaceId: String(workspaceId) };
  if (!options.includeArchived) filter.archivedAt = null;
  const boards = await BoardModel.find(filter)
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean<BoardDoc[]>()
    .exec();
  // Private boards: only explicit members (or requester-provided userId) see them.
  if (!options.userId) return boards;
  return boards.filter(
    (b) => b.visibility === 'workspace' || b.memberIds.includes(options.userId!) || b.createdBy === options.userId,
  );
}

export async function updateBoard(
  id: string,
  workspaceId: string,
  update: Record<string, unknown>,
  session?: ClientSession,
): Promise<BoardDoc | null> {
  const q = BoardModel.findOneAndUpdate({ _id: id, workspaceId }, { $set: update }, { new: true });
  return ((session ? q.session(session) : q).lean<BoardDoc>().exec()) ?? null;
}

export async function incBoardStats(
  id: string,
  delta: Partial<Record<keyof IBoard['stats'], number>>,
  session?: ClientSession,
): Promise<void> {
  await BoardModel.updateOne({ _id: id }, { $inc: Object.fromEntries(Object.entries(delta).map(([key, value]) => [`stats.${key}`, value])) }, { session }).exec();
}

export async function softDeleteBoard(id: string, workspaceId: string, actorId: string, session?: ClientSession): Promise<boolean> {
  const result = await BoardModel.findOneAndUpdate(
    { _id: id, workspaceId },
    { $set: { deletedAt: new Date(), deletedBy: actorId, archivedAt: new Date() } },
    { session },
  ).exec();
  return result !== null;
}

// ── Lists ─────────────────────────────────────────────────────────────

export async function createList(
  data: Pick<IList, 'workspaceId' | 'boardId' | 'name' | 'order'> & Partial<IList>,
  session?: ClientSession,
): Promise<ListDoc> {
  const [list] = await ListModel.create([data], { session });
  return list!.toObject();
}

export async function findListById(
  id: string,
  session?: ClientSession,
): Promise<ListDoc | null> {
  const q = ListModel.findOne({ _id: id });
  return ((session ? q.session(session) : q).lean<ListDoc>().exec()) ?? null;
}

export async function findListsByBoard(boardId: string, session?: ClientSession): Promise<ListDoc[]> {
  const q = ListModel.find({ boardId, archivedAt: null }).sort({ order: 1 });
  return (session ? q.session(session) : q).lean<ListDoc[]>().exec();
}

export async function findListsByIds(ids: string[], session?: ClientSession): Promise<ListDoc[]> {
  if (ids.length === 0) return [];
  const q = ListModel.find({ _id: { $in: ids } });
  return (session ? q.session(session) : q).lean<ListDoc[]>().exec();
}

export async function getLastListOrder(boardId: string, session?: ClientSession): Promise<string | null> {
  const q = ListModel.findOne({ boardId, archivedAt: null }).sort({ order: -1 }).select('order');
  const list = await (session ? q.session(session) : q).lean<{ order: string }>().exec();
  return list?.order ?? null;
}

export async function updateList(
  id: string,
  update: Record<string, unknown>,
  session?: ClientSession,
): Promise<ListDoc | null> {
  const q = ListModel.findOneAndUpdate({ _id: id }, { $set: update }, { new: true });
  return ((session ? q.session(session) : q).lean<ListDoc>().exec()) ?? null;
}

export async function bulkUpdateListOrders(
  updates: Array<{ id: string; order: string }>,
  session?: ClientSession,
): Promise<void> {
  if (updates.length === 0) return;
  await ListModel.bulkWrite(
    updates.map((u) => ({ updateOne: { filter: { _id: u.id }, update: { $set: { order: u.order } } } })),
    { session },
  );
}

export async function incListCardCount(listId: string, delta: number, session?: ClientSession): Promise<void> {
  await ListModel.updateOne({ _id: listId }, { $inc: { cardCount: delta } }, { session }).exec();
}

export async function softDeleteList(id: string, actorId: string, session?: ClientSession): Promise<boolean> {
  const result = await ListModel.findOneAndUpdate(
    { _id: id },
    { $set: { deletedAt: new Date(), deletedBy: actorId } },
    session ? { session } : {},
  ).exec();
  return result !== null;
}

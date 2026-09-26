import { BOARD_CACHE_TTL } from './cacheTags.js';
import { evenKeys, firstKey, incrementKey, keyBetween } from '@orbit/shared';
import { runInTransaction } from '../../infrastructure/db/transaction.js';
import { invalidateTag } from '../../infrastructure/cache/cacheService.js';
import { getOrSet } from '../../infrastructure/cache/cacheService.js';
import { badRequest, notFound } from '../../infrastructure/errors/ApiError.js';
import { emitSafe } from '../../infrastructure/events/eventBus.js';
import { createActivity } from '../activities/activities.repository.js';
import { recordAudit } from '../audit/audit.service.js';
import { incWorkspaceStats } from '../workspaces/workspaces.repository.js';
import { findUsersByIds } from '../users/users.repository.js';
import { ListModel } from './lists.model.js';
import {
  createBoard,
  createList,
  findBoardByIdScoped,
  findListById,
  findListsByBoard,
  getLastListOrder,
  incBoardStats,
  listBoards,
  softDeleteBoard,
  softDeleteList,
  updateBoard,
  updateList,
  bulkUpdateListOrders,
  type BoardDoc,
  type ListDoc,
} from './boards.repository.js';
import { CardModel } from '../cards/cards.model.js';
import type {
  CreateBoardInput,
  CreateListInput,
  ReorderListsInput,
  UpdateBoardInput,
  UpdateListInput,
} from './boards.schema.js';

export interface Actor {
  userId: string;
  role: string;
}

function boardId(board: BoardDoc): string {
  return String(board._id);
}

async function loadBoardOr404(boardIdRaw: string, workspaceId: string): Promise<BoardDoc> {
  const board = await findBoardByIdScoped(boardIdRaw, workspaceId);
  if (!board) throw notFound('Board');
  return board;
}

export async function createBoardForWorkspace(
  workspaceId: string,
  input: CreateBoardInput,
  actor: Actor,
): Promise<Record<string, unknown>> {
  const board = await runInTransaction(
    async (tx) => {
      const created = await createBoard(
        {
          workspaceId,
          name: input.name,
          description: input.description,
          visibility: input.visibility,
          memberIds: input.memberIds ?? [],
          background: input.background ?? 'gradient-1',
          createdBy: actor.userId,
        },
        tx.session,
      );
      await incWorkspaceStats(workspaceId, { boardCount: 1 }, tx.session);
      await createActivity(
        {
          workspaceId,
          entityType: 'board',
          entityId: boardId(created),
          actorId: actor.userId,
          action: 'created',
        },
        tx.session,
      );
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'board.create',
        entityType: 'board',
        entityId: boardId(created),
        workspaceId,
        after: { name: created.name, visibility: created.visibility },
        session: tx.session,
      });
      return created;
    },
    { name: 'create-board' },
  );

  await invalidateTag(`ws:${workspaceId}:boards`);
  emitSafe(`workspace:${workspaceId}`, 'board:created', { boardId: boardId(board), workspaceId });
  return serializeBoard(board);
}

export function serializeBoard(board: BoardDoc): Record<string, unknown> {
  return {
    id: boardId(board),
    workspaceId: board.workspaceId,
    name: board.name,
    description: board.description ?? null,
    visibility: board.visibility,
    memberIds: board.memberIds,
    background: board.background,
    stats: board.stats,
    archivedAt: board.archivedAt,
    createdBy: board.createdBy,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
  };
}

export async function listBoardsForUser(
  workspaceId: string,
  userId: string,
  includeArchived: boolean,
): Promise<unknown[]> {
  return getOrSet(
    `ws:${workspaceId}:boards:${userId}:${includeArchived ? 'all' : 'active'}`,
    async () => (await listBoards(workspaceId, { includeArchived, userId })).map(serializeBoard),
    { ttlSeconds: 60, tags: [`ws:${workspaceId}:boards`] },
  );
}

export async function getBoardDetails(
  boardIdRaw: string,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const board = await loadBoardOr404(boardIdRaw, workspaceId);
  return getOrSet(`board:${boardIdRaw}:view`, () => buildBoardView(board), {
    ttlSeconds: BOARD_CACHE_TTL,
    tags: [`board:${boardIdRaw}`],
  });
}

interface BoardCardRaw extends Record<string, unknown> {
  assignees?: string[];
}
type BoardListView = ListDoc & { cards: BoardCardRaw[] };

async function buildBoardView(board: BoardDoc): Promise<Record<string, unknown>> {
  const rows = await ListModel.aggregate<BoardListView>([
    { $match: { boardId: String(board._id), archivedAt: null, deletedAt: null } },
    { $sort: { order: 1 } },
    {
      $lookup: {
        from: 'cards',
        let: { lid: { $toString: '$_id' } },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$listId', '$$lid'] },
              archivedAt: null,
              deletedAt: null,
            },
          },
          { $sort: { order: 1 } },
          { $limit: 100 },
        ],
        as: 'cards',
      },
    },
  ]).exec();

  const assigneeIds = new Set<string>();
  for (const list of rows) {
    for (const card of list.cards) {
      for (const a of card.assignees ?? []) assigneeIds.add(a);
    }
  }
  const users = await findUsersByIds([...assigneeIds]);
  const profiles = new Map(
    users.map((u) => [
      String(u._id),
      { id: String(u._id), name: u.name, handle: u.handle, avatarUrl: u.avatarUrl ?? null },
    ]),
  );

  return {
    board: serializeBoard(board),
    lists: rows.map((list) => ({
      id: String(list._id),
      name: list.name,
      order: list.order,
      color: list.color ?? null,
      wipLimit: list.wipLimit ?? null,
      cardCount: list.cardCount,
      cards: list.cards.map((card) => ({
        ...card,
        id: String(card._id),
        assigneeProfiles: (card.assignees ?? [])
          .map((a) => profiles.get(a) ?? null)
          .filter(Boolean),
      })),
    })),
  };
}

export async function updateBoardDetails(
  boardIdRaw: string,
  workspaceId: string,
  input: UpdateBoardInput,
  actor: Actor,
): Promise<Record<string, unknown>> {
  const board = await loadBoardOr404(boardIdRaw, workspaceId);
  const update: Record<string, unknown> = {};
  for (const key of ['name', 'description', 'visibility', 'memberIds', 'background'] as const) {
    if (input[key] !== undefined) update[key] = input[key];
  }
  if (input.archivedAt !== undefined) update.archivedAt = input.archivedAt ? new Date() : null;

  const updated = await updateBoard(boardIdRaw, workspaceId, update);
  if (!updated) throw notFound('Board');

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'board.update',
    entityType: 'board',
    entityId: boardIdRaw,
    workspaceId,
    before: { name: board.name, visibility: board.visibility },
    after: update,
  });
  await invalidateTag(`board:${boardIdRaw}`);
  await invalidateTag(`ws:${workspaceId}:boards`);
  emitSafe(`workspace:${workspaceId}`, 'board:updated', { boardId: boardIdRaw, workspaceId });
  return serializeBoard(updated);
}

export async function deleteBoardSoft(
  boardIdRaw: string,
  workspaceId: string,
  actor: Actor,
): Promise<void> {
  const board = await loadBoardOr404(boardIdRaw, workspaceId);
  await runInTransaction(
    async (tx) => {
      await softDeleteBoard(boardIdRaw, workspaceId, actor.userId, tx.session);
      await incWorkspaceStats(workspaceId, { boardCount: -1 }, tx.session);
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'board.delete',
        entityType: 'board',
        entityId: boardIdRaw,
        workspaceId,
        before: { name: board.name },
        session: tx.session,
      });
    },
    { name: 'delete-board' },
  );
  await invalidateTag(`board:${boardIdRaw}`);
  await invalidateTag(`ws:${workspaceId}:boards`);
  emitSafe(`workspace:${workspaceId}`, 'board:deleted', { boardId: boardIdRaw, workspaceId });
}

export async function createListOnBoard(
  boardIdRaw: string,
  workspaceId: string,
  input: CreateListInput,
  actor: Actor,
): Promise<Record<string, unknown>> {
  const board = await loadBoardOr404(boardIdRaw, workspaceId);
  const lastOrder = await getLastListOrder(boardIdRaw);
  const order = lastOrder === null ? firstKey() : incrementKey(lastOrder);

  const list = await runInTransaction(
    async (tx) => {
      const created = await createList(
        {
          workspaceId,
          boardId: boardIdRaw,
          name: input.name,
          order,
          color: input.color,
          wipLimit: input.wipLimit ?? null,
        },
        tx.session,
      );
      await incBoardStats(boardIdRaw, { listCount: 1 }, tx.session);
      await createActivity(
        {
          workspaceId,
          entityType: 'list',
          entityId: boardIdRaw,
          actorId: actor.userId,
          action: 'list_created',
          meta: { listName: input.name, listId: String(created._id) },
        },
        tx.session,
      );
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'list.create',
        entityType: 'list',
        entityId: String(created._id),
        workspaceId,
        after: { name: created.name, boardId: boardIdRaw },
        session: tx.session,
      });
      return created;
    },
    { name: 'create-list' },
  );

  void board;
  await invalidateTag(`board:${boardIdRaw}`);
  emitSafe(`board:${boardIdRaw}`, 'list:created', {
    listId: String(list._id),
    boardId: boardIdRaw,
  });
  return serializeList(list);
}

export function serializeList(list: ListDoc): Record<string, unknown> {
  return {
    id: String(list._id),
    boardId: list.boardId,
    name: list.name,
    order: list.order,
    color: list.color ?? null,
    wipLimit: list.wipLimit ?? null,
    cardCount: list.cardCount,
    archivedAt: list.archivedAt,
  };
}

export async function updateListDetails(
  listIdRaw: string,
  workspaceId: string,
  input: UpdateListInput,
  actor: Actor,
): Promise<Record<string, unknown>> {
  const list = await findListById(listIdRaw);
  if (!list || list.workspaceId !== workspaceId) throw notFound('List');

  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.color !== undefined) update.color = input.color;
  if (input.wipLimit !== undefined) update.wipLimit = input.wipLimit;
  if (input.archivedAt !== undefined) update.archivedAt = input.archivedAt ? new Date() : null;

  const updated = await updateList(listIdRaw, update);
  if (!updated) throw notFound('List');
  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'list.update',
    entityType: 'list',
    entityId: listIdRaw,
    workspaceId,
    after: update,
  });
  await invalidateTag(`board:${list.boardId}`);
  emitSafe(`board:${list.boardId}`, 'list:updated', { listId: listIdRaw, boardId: list.boardId });
  return serializeList(updated);
}

export async function deleteListWithGuard(
  listIdRaw: string,
  workspaceId: string,
  force: boolean,
  actor: Actor,
): Promise<void> {
  const list = await findListById(listIdRaw);
  if (!list || list.workspaceId !== workspaceId) throw notFound('List');

  const cardCount = await CardModel.countDocuments({ listId: listIdRaw, archivedAt: null }).exec();
  if (cardCount > 0 && !force) {
    throw badRequest(
      `List still holds ${cardCount} card(s) — pass force=true to archive them all`,
      {
        cardCount,
      },
    );
  }

  await runInTransaction(
    async (tx) => {
      await softDeleteList(listIdRaw, actor.userId, tx.session);
      if (cardCount > 0) {
        await CardModel.updateMany(
          { listId: listIdRaw },
          { $set: { deletedAt: new Date(), deletedBy: actor.userId } },
          tx.session ? { session: tx.session } : undefined,
        ).exec();
      }
      await incBoardStats(list.boardId, { listCount: -1, cardCount: -cardCount }, tx.session);
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'list.delete',
        entityType: 'list',
        entityId: listIdRaw,
        workspaceId,
        before: { name: list.name, cardCount },
        session: tx.session,
      });
    },
    { name: 'delete-list' },
  );
  await invalidateTag(`board:${list.boardId}`);
  emitSafe(`board:${list.boardId}`, 'list:deleted', { listId: listIdRaw, boardId: list.boardId });
}

export async function reorderLists(
  workspaceId: string,
  input: ReorderListsInput,
  actor: Actor,
): Promise<{ listIds: string[] }> {
  const board = await loadBoardOr404(input.boardId, workspaceId);
  const current = await findListsByBoard(input.boardId);
  const currentIds = new Set(current.map((l) => String(l._id)));
  const requested = new Set(input.listIds);

  if (currentIds.size !== requested.size || [...requested].some((id) => !currentIds.has(id))) {
    throw badRequest("listIds must be exactly the board's active lists in the new order");
  }

  const newOrders = evenKeys(input.listIds.length);
  await runInTransaction(
    async (tx) => {
      await bulkUpdateListOrders(
        input.listIds.map((id, i) => ({ id, order: newOrders[i]! })),
        tx.session,
      );
      await updateBoard(boardId(board), workspaceId, { updatedAt: new Date() }, tx.session);
      await createActivity(
        {
          workspaceId,
          entityType: 'board',
          entityId: boardId(board),
          actorId: actor.userId,
          action: 'lists_reordered',
        },
        tx.session,
      );
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'list.reorder',
        entityType: 'board',
        entityId: boardId(board),
        workspaceId,
        after: { order: input.listIds },
        session: tx.session,
      });
    },
    { name: 'T5-list-reorder' },
  );

  await invalidateTag(`board:${boardId(board)}`);
  emitSafe(`board:${boardId(board)}`, 'list:reordered', {
    boardId: boardId(board),
    listIds: input.listIds,
  });
  return { listIds: input.listIds };
}

export function orderBetween(prev: string | null, next: string | null): string {
  return keyBetween(prev, next);
}

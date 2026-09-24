/**
 * Boards & lists routes (BUILD_PROMPT Phase 6).
 * Item routes derive the tenant from the resource via authorize({load}) —
 * foreign or invisible resources answer 404.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize, type ScopeDescriptor } from '../../middleware/authorize.js';
import { idempotency } from '../../middleware/idempotency.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { findBoardById, findBoardByIdScoped, findListById } from './boards.repository.js';
import * as controller from './boards.controller.js';
import {
  boardParamsSchema,
  createBoardSchema,
  createListSchema,
  deleteListQuerySchema,
  listParamsSchema,
  reorderListsSchema,
  updateBoardSchema,
  updateListSchema,
  widParamsSchema,
} from './boards.schema.js';

export const boardsRouter = Router();

const writeLimit = rateLimit({ tier: 'write' });

/** Scope loader: board by id, tenant-agnostic (the guard checks membership). */
async function loadBoard(req: Request): Promise<ScopeDescriptor | null> {
  const auth = req.auth!;
  const board =
    (await findBoardByIdScoped(String(req.params.id), auth.workspaceId ?? '')) ??
    (await findBoardById(String(req.params.id)));
  if (!board) return null;
  return {
    workspaceId: board.workspaceId,
    createdBy: board.createdBy,
    visibility: board.visibility,
    memberIds: board.memberIds,
  };
}

/** Scope loader: list by id → its board's descriptor. */
async function loadList(req: Request): Promise<ScopeDescriptor | null> {
  const list = await findListById(String(req.params.id));
  if (!list) return null;
  const fakeReq = { params: { id: list.boardId }, auth: req.auth } as unknown as Request;
  return loadBoard(fakeReq);
}

// ── Workspace-scoped board collection ─────────────────────────────────
boardsRouter.post(
  '/workspaces/:wid/boards',
  authenticate(),
  writeLimit,
  validate({ params: widParamsSchema, body: createBoardSchema }),
  idempotency(),
  authorize('board:create', { workspaceParam: 'wid' }),
  controller.createBoard,
);
boardsRouter.get(
  '/workspaces/:wid/boards',
  authenticate(),
  validate({
    params: widParamsSchema,
    query: z.object({ includeArchived: z.enum(['true', 'false']).optional() }),
  }),
  authorize('board:read', { workspaceParam: 'wid' }),
  controller.listBoards,
);

// ── Board item ────────────────────────────────────────────────────────
boardsRouter.get(
  '/boards/:id',
  authenticate(),
  validate({ params: boardParamsSchema }),
  authorize('board:read', { load: loadBoard }),
  controller.getBoard,
);
boardsRouter.patch(
  '/boards/:id',
  authenticate(),
  writeLimit,
  validate({ params: boardParamsSchema, body: updateBoardSchema }),
  authorize('board:update', { load: loadBoard }),
  controller.updateBoard,
);
boardsRouter.delete(
  '/boards/:id',
  authenticate(),
  validate({ params: boardParamsSchema }),
  authorize('board:delete', { load: loadBoard }),
  controller.deleteBoard,
);

// ── Lists ─────────────────────────────────────────────────────────────
boardsRouter.post(
  '/boards/:id/lists',
  authenticate(),
  writeLimit,
  validate({ params: boardParamsSchema, body: createListSchema }),
  idempotency(),
  authorize('list:create', { load: loadBoard }),
  controller.createList,
);
// NOTE: this static path MUST be registered before '/lists/:id' — Express 5
// matches in registration order, so '/lists/reorder' declared afterwards would
// be swallowed by the ':id' route and rejected by its objectId validation (422).
boardsRouter.patch(
  '/lists/reorder',
  authenticate(),
  writeLimit,
  validate({ body: reorderListsSchema }),
  authorize('list:reorder', { load: (req) => loadBoard({ ...req, params: { id: (req.body as { boardId: string }).boardId } } as unknown as Request) }),
  controller.reorderLists,
);
boardsRouter.patch(
  '/lists/:id',
  authenticate(),
  writeLimit,
  validate({ params: listParamsSchema, body: updateListSchema }),
  authorize('list:update', { load: loadList }),
  controller.updateList,
);
boardsRouter.delete(
  '/lists/:id',
  authenticate(),
  validate({ params: listParamsSchema, query: deleteListQuerySchema }),
  authorize('list:delete', { load: loadList }),
  controller.deleteList,
);

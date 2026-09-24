/**
 * Boards controller — HTTP plumbing only.
 */
import type { Request, Response } from 'express';
import { created, noContent, ok } from '../../infrastructure/http/response.js';
import { requireAuth } from '../../middleware/authenticate.js';
import * as service from './boards.service.js';
import type {
  CreateBoardInput,
  CreateListInput,
  ReorderListsInput,
  UpdateBoardInput,
  UpdateListInput,
} from './boards.schema.js';

export async function createBoard(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const board = await service.createBoardForWorkspace(String(req.params.wid), req.body as CreateBoardInput, {
    userId: auth.userId,
    role: auth.role!,
  });
  created(res, board);
}

export async function listBoards(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const includeArchived = req.query.includeArchived === 'true';
  const boards = await service.listBoardsForUser(String(req.params.wid), auth.userId, includeArchived);
  ok(res, { boards });
}

export async function getBoard(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  ok(res, await service.getBoardDetails(String(req.params.id), auth.workspaceId!));
}

export async function updateBoard(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  ok(
    res,
    await service.updateBoardDetails(String(req.params.id), auth.workspaceId!, req.body as UpdateBoardInput, {
      userId: auth.userId,
      role: auth.role!,
    }),
  );
}

export async function deleteBoard(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  await service.deleteBoardSoft(String(req.params.id), auth.workspaceId!, { userId: auth.userId, role: auth.role! });
  noContent(res);
}

export async function createList(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const list = await service.createListOnBoard(String(req.params.id), auth.workspaceId!, req.body as CreateListInput, {
    userId: auth.userId,
    role: auth.role!,
  });
  created(res, list);
}

export async function updateList(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  ok(
    res,
    await service.updateListDetails(String(req.params.id), auth.workspaceId!, req.body as UpdateListInput, {
      userId: auth.userId,
      role: auth.role!,
    }),
  );
}

export async function deleteList(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const force = req.query.force === 'true';
  await service.deleteListWithGuard(String(req.params.id), auth.workspaceId!, force, {
    userId: auth.userId,
    role: auth.role!,
  });
  noContent(res);
}

export async function reorderLists(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  ok(res, await service.reorderLists(auth.workspaceId!, req.body as ReorderListsInput, {
    userId: auth.userId,
    role: auth.role!,
  }));
}

/**
 * Cards controller — HTTP plumbing only.
 */
import type { Request, Response } from 'express';
import { created, noContent, ok } from '../../infrastructure/http/response.js';
import { requireAuth } from '../../middleware/authenticate.js';
import * as service from './cards.service.js';
import type {
  CommentInput,
  CreateCardFromMessageInput,
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from '../boards/boards.schema.js';

export async function listCards(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const result = await service.listBoardCards(String(req.params.id), auth.workspaceId!, req.query);
  ok(res, { cards: result.cards }, { nextCursor: result.nextCursor });
}

export async function createCard(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const card = await service.createCardInList(String(req.params.id), auth.workspaceId!, req.body as CreateCardInput, {
    userId: auth.userId,
    role: auth.role!,
  });
  created(res, card);
}

export async function getCard(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  ok(res, await service.getCardDetails(String(req.params.id), auth.workspaceId!));
}

export async function updateCard(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  ok(
    res,
    await service.updateCardDetails(String(req.params.id), auth.workspaceId!, req.body as UpdateCardInput, {
      userId: auth.userId,
      role: auth.role!,
    }),
  );
}

export async function moveCard(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  ok(
    res,
    await service.moveCard(String(req.params.id), auth.workspaceId!, req.body as MoveCardInput, {
      userId: auth.userId,
      role: auth.role!,
    }),
  );
}

export async function deleteCard(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  await service.deleteCardSoft(String(req.params.id), auth.workspaceId!, { userId: auth.userId, role: auth.role! });
  noContent(res);
}

export async function restoreCard(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  ok(res, await service.restoreSoftDeletedCard(String(req.params.id), auth.workspaceId!, {
    userId: auth.userId,
    role: auth.role!,
  }));
}

export async function cardActivity(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const query = {
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
  };
  ok(res, await service.getCardActivity(String(req.params.id), auth.workspaceId!, query));
}

export async function cardComments(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  ok(res, { comments: await service.getCardComments(String(req.params.id), auth.workspaceId!) });
}

export async function addComment(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const comment = await service.addCardComment(String(req.params.id), auth.workspaceId!, req.body as CommentInput, {
    userId: auth.userId,
    role: auth.role!,
  });
  created(res, comment);
}

export async function createFromMessage(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const card = await service.createCardFromMessage(auth.workspaceId!, req.body as CreateCardFromMessageInput, {
    userId: auth.userId,
    role: auth.role!,
  });
  created(res, card);
}

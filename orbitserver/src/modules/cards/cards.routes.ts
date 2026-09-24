/**
 * Card routes (BUILD_PROMPT Phase 6) — including the T2 move endpoint.
 */
import { Router, type Request } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize, type ScopeDescriptor } from '../../middleware/authorize.js';
import { idempotency } from '../../middleware/idempotency.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { BoardModel } from '../boards/boards.model.js';
import { findCardByIdScoped } from './cards.repository.js';
import * as controller from './cards.controller.js';
import {
  cardParamsSchema,
  commentSchema,
  createCardSchema,
  cursorQuerySchema,
  listCardsQuerySchema,
  listParamsSchema,
  moveCardSchema,
  updateCardSchema,
} from '../boards/boards.schema.js';

export const cardsRouter = Router();

const writeLimit = rateLimit({ tier: 'write' });

/** Scope loader: card → its board's visibility descriptor. */
async function loadCard(req: Request): Promise<ScopeDescriptor | null> {
  const auth = req.auth!;
  const card =
    (await findCardByIdScoped(String(req.params.id), auth.workspaceId ?? '')) ??
    (await import('./cards.repository.js').then((r) => r.findCardById(String(req.params.id))));
  if (!card) return null;
  const board = await BoardModel.findOne({ _id: card.boardId })
    .lean<{ workspaceId: string; createdBy: string; visibility: 'workspace' | 'private'; memberIds: string[] }>()
    .exec();
  if (!board) return null;
  return {
    workspaceId: board.workspaceId,
    createdBy: board.createdBy,
    visibility: board.visibility,
    memberIds: board.memberIds,
  };
}

/** Scope loader: list (for POST /lists/:id/cards). */
async function loadList(req: Request): Promise<ScopeDescriptor | null> {
  const { findListById } = await import('../boards/boards.repository.js');
  const list = await findListById(String(req.params.id));
  if (!list) return null;
  const board = await BoardModel.findOne({ _id: list.boardId })
    .lean<{ workspaceId: string; createdBy: string; visibility: 'workspace' | 'private'; memberIds: string[] }>()
    .exec();
  if (!board) return null;
  return {
    workspaceId: board.workspaceId,
    createdBy: board.createdBy,
    visibility: board.visibility,
    memberIds: board.memberIds,
  };
}

// Board-scoped card collection.
cardsRouter.get(
  '/boards/:id/cards',
  authenticate(),
  validate({ params: cardParamsSchema, query: listCardsQuerySchema }),
  authorize('card:read'),
  controller.listCards,
);
cardsRouter.post(
  '/lists/:id/cards',
  authenticate(),
  writeLimit,
  validate({ params: listParamsSchema, body: createCardSchema }),
  idempotency(),
  authorize('card:create', { load: loadList }),
  controller.createCard,
);

// Card item.
cardsRouter.get('/cards/:id', validate({ params: cardParamsSchema }), authorize('card:read', { load: loadCard }), controller.getCard);
cardsRouter.patch(
  '/cards/:id',
  authenticate(),
  writeLimit,
  validate({ params: cardParamsSchema, body: updateCardSchema }),
  authorize('card:update', { load: loadCard }),
  controller.updateCard,
);
cardsRouter.patch(
  '/cards/:id/move',
  authenticate(),
  writeLimit,
  validate({ params: cardParamsSchema, body: moveCardSchema }),
  authorize('card:move', { load: loadCard }),
  controller.moveCard,
);
cardsRouter.delete(
  '/cards/:id',
  authenticate(),
  validate({ params: cardParamsSchema }),
  authorize('card:delete', { load: loadCard }),
  controller.deleteCard,
);
cardsRouter.post(
  '/cards/:id/restore',
  authenticate(),
  writeLimit,
  validate({ params: cardParamsSchema }),
  authorize('card:update', { load: loadCard }),
  controller.restoreCard,
);
cardsRouter.get(
  '/cards/:id/activity',
  authenticate(),
  validate({ params: cardParamsSchema, query: cursorQuerySchema }),
  authorize('card:read', { load: loadCard }),
  controller.cardActivity,
);
cardsRouter.get(
  '/cards/:id/comments',
  authenticate(),
  validate({ params: cardParamsSchema }),
  authorize('card:read', { load: loadCard }),
  controller.cardComments,
);
cardsRouter.post(
  '/cards/:id/comments',
  authenticate(),
  writeLimit,
  validate({ params: cardParamsSchema, body: commentSchema }),
  idempotency(),
  authorize('card:comment', { load: loadCard }),
  controller.addComment,
);

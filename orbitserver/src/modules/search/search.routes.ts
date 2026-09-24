/**
 * Unified Search routes (BUILD_PROMPT Phase 11 — Faceted Search).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ok } from '../../infrastructure/http/response.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { CardModel } from '../cards/cards.model.js';
import { PageModel } from '../pages/pages.model.js';
import { ChannelModel } from '../chat/channels.model.js';
import { MessageModel } from '../chat/messages.model.js';
import { BoardModel } from '../boards/boards.model.js';

export const searchRouter = Router();

const searchLimit = rateLimit({ tier: 'search' });
const widParams = z.object({ wid: z.string().regex(/^[0-9a-fA-F]{24}$/) });
const searchQuery = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

searchRouter.use(authenticate());

searchRouter.get(
  '/workspaces/:wid/search',
  searchLimit,
  validate({ params: widParams, query: searchQuery }),
  authorize('board:read', { workspaceParam: 'wid' }),
  async (req: Request, res: Response) => {
    const wid = String(req.params.wid);
    const queryObj = req.query as { q: string; limit?: string };
    const q = queryObj.q.trim();
    const limit = Number(queryObj.limit) || 20;

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [cards, pages, channels, messages] = await Promise.all([
      CardModel.find({
        workspaceId: wid,
        deletedAt: null,
        $or: [{ title: regex }, { description: regex }],
      })
        .select('_id title description listId boardId priority dueAt completedAt')
        .limit(limit)
        .lean()
        .exec(),

      PageModel.find({
        workspaceId: wid,
        deletedAt: null,
        $or: [{ title: regex }, { plainText: regex }],
      })
        .select('_id title icon parentId depth visibility updatedAt')
        .limit(limit)
        .lean()
        .exec(),

      ChannelModel.find({
        workspaceId: wid,
        deletedAt: null,
        $or: [{ name: regex }, { topic: regex }],
      })
        .select('_id name topic type messageCount')
        .limit(limit)
        .lean()
        .exec(),

      MessageModel.find({
        workspaceId: wid,
        deletedAt: null,
        body: regex,
      })
        .select('_id channelId authorId body createdAt')
        .limit(limit)
        .lean()
        .exec(),
    ]);

    const totalResults = cards.length + pages.length + channels.length + messages.length;

    ok(res, {
      query: q,
      totalResults,
      results: {
        cards: cards.map((c) => ({ ...c, id: c._id.toString() })),
        pages: pages.map((p) => ({ ...p, id: p._id.toString() })),
        channels: channels.map((ch) => ({ ...ch, id: ch._id.toString() })),
        messages: messages.map((m) => ({ ...m, id: m._id.toString() })),
      },
    });
  },
);

searchRouter.get(
  '/workspaces/:wid/search/suggestions',
  searchLimit,
  validate({ params: widParams }),
  authorize('board:read', { workspaceParam: 'wid' }),
  async (req: Request, res: Response) => {
    const wid = String(req.params.wid);

    const [boards, pages, channels] = await Promise.all([
      BoardModel.find({ workspaceId: wid, deletedAt: null })
        .select('_id name')
        .limit(5)
        .lean()
        .exec(),
      PageModel.find({ workspaceId: wid, deletedAt: null })
        .select('_id title icon')
        .limit(5)
        .lean()
        .exec(),
      ChannelModel.find({ workspaceId: wid, deletedAt: null, type: 'public' })
        .select('_id name')
        .limit(5)
        .lean()
        .exec(),
    ]);

    ok(res, {
      suggestions: {
        boards: boards.map((b) => ({ id: b._id.toString(), title: b.name, type: 'board' })),
        pages: pages.map((p) => ({ id: p._id.toString(), title: p.title, icon: p.icon, type: 'page' })),
        channels: channels.map((c) => ({ id: c._id.toString(), title: c.name, type: 'channel' })),
      },
    });
  },
);

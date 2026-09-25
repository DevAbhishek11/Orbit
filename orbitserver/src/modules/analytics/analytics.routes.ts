import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ok } from '../../infrastructure/http/response.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { BoardModel } from '../boards/boards.model.js';
import { CardModel } from '../cards/cards.model.js';
import { PageModel } from '../pages/pages.model.js';
import { ChannelModel } from '../chat/channels.model.js';
import { MessageModel } from '../chat/messages.model.js';
import { WorkspaceMemberModel } from '../workspaces/workspaceMembers.model.js';

export const analyticsRouter = Router();

const widParams = z.object({ wid: z.string().regex(/^[0-9a-fA-F]{24}$/) });
const boardParams = z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/) });

analyticsRouter.use(authenticate());

analyticsRouter.get(
  '/analytics/workspaces/:wid/overview',
  validate({ params: widParams }),
  authorize('admin:analytics', { workspaceParam: 'wid' }),
  async (req: Request, res: Response) => {
    const wid = String(req.params.wid);
    const now = new Date();

    const [
      boardCount,
      totalCards,
      completedCards,
      overdueCards,
      pageCount,
      channelCount,
      messageCount,
      memberCount,
    ] = await Promise.all([
      BoardModel.countDocuments({ workspaceId: wid, deletedAt: null }).exec(),
      CardModel.countDocuments({ workspaceId: wid, deletedAt: null }).exec(),
      CardModel.countDocuments({
        workspaceId: wid,
        deletedAt: null,
        completedAt: { $ne: null },
      }).exec(),
      CardModel.countDocuments({
        workspaceId: wid,
        deletedAt: null,
        completedAt: null,
        dueAt: { $lt: now },
      }).exec(),
      PageModel.countDocuments({ workspaceId: wid, deletedAt: null }).exec(),
      ChannelModel.countDocuments({ workspaceId: wid, deletedAt: null }).exec(),
      MessageModel.countDocuments({ workspaceId: wid, deletedAt: null }).exec(),
      WorkspaceMemberModel.countDocuments({ workspaceId: wid, status: 'active' }).exec(),
    ]);

    const activeCards = totalCards - completedCards;
    const completionRate = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

    ok(res, {
      kpis: {
        totalCards,
        completedCards,
        activeCards,
        overdueCards,
        completionRate,
        pageCount,
        channelCount,
        messageCount,
        boardCount,
        memberCount,
      },
    });
  },
);

analyticsRouter.get(
  '/analytics/boards/:id/burndown',
  validate({ params: boardParams }),
  async (req: Request, res: Response) => {
    const boardId = String(req.params.id);

    const cards = await CardModel.find({ boardId, deletedAt: null })
      .select('_id title listId completedAt dueAt priority createdAt')
      .lean()
      .exec();

    const total = cards.length;
    const completed = cards.filter((c) => Boolean(c.completedAt)).length;
    const remaining = total - completed;

    ok(res, {
      boardId,
      total,
      completed,
      remaining,
      cards: cards.map((c) => ({
        id: c._id.toString(),
        title: c.title,
        listId: c.listId,
        completed: Boolean(c.completedAt),
        dueAt: c.dueAt,
        priority: c.priority,
      })),
    });
  },
);

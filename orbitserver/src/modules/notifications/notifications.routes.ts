/**
 * Notifications routes (BUILD_PROMPT Phase 11).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ok } from '../../infrastructure/http/response.js';
import { authenticate, requireAuth } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { NotificationModel } from './notifications.model.js';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate());

notificationsRouter.get('/', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const query = req.query as { limit?: string; unreadOnly?: string };
  const limit = Math.min(Number(query.limit ?? 50) || 50, 100);

  const filter: Record<string, unknown> = { userId: auth.userId };
  if (query.unreadOnly === 'true') {
    filter.readAt = null;
  }

  const [notifications, unreadCount] = await Promise.all([
    NotificationModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean().exec(),
    NotificationModel.countDocuments({ userId: auth.userId, readAt: null }).exec(),
  ]);

  ok(res, { notifications, unreadCount });
});

notificationsRouter.post(
  '/read',
  validate({
    body: z.object({
      all: z.boolean().optional(),
      notificationIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
    }),
  }),
  async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const body = req.body as { all?: boolean; notificationIds?: string[] };
    const now = new Date();

    if (body.all) {
      await NotificationModel.updateMany(
        { userId: auth.userId, readAt: null },
        { $set: { readAt: now } },
      ).exec();
    } else if (body.notificationIds?.length) {
      await NotificationModel.updateMany(
        { userId: auth.userId, _id: { $in: body.notificationIds } },
        { $set: { readAt: now } },
      ).exec();
    }

    const unreadCount = await NotificationModel.countDocuments({
      userId: auth.userId,
      readAt: null,
    }).exec();

    ok(res, { success: true, unreadCount });
  },
);

notificationsRouter.get('/summary', async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const unreadCount = await NotificationModel.countDocuments({
    userId: auth.userId,
    readAt: null,
  }).exec();

  ok(res, { unreadCount });
});

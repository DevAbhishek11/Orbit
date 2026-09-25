import mongoose from 'mongoose';
import { dependencyUnavailable } from '../infrastructure/errors/ApiError.js';
import { Router } from 'express';
import { env } from '../config/env.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { authRouter } from './auth/auth.routes.js';
import { boardsRouter } from './boards/boards.routes.js';
import { cardsRouter } from './cards/cards.routes.js';
import { pagesRouter } from './pages/pages.routes.js';
import { chatRouter } from './chat/chat.routes.js';
import { notificationsRouter } from './notifications/notifications.routes.js';
import { searchRouter } from './search/search.routes.js';
import { analyticsRouter } from './analytics/analytics.routes.js';
import { filesRouter } from './files/files.routes.js';
import { adminQueuesRouter } from './admin/queues.routes.js';
import { usersRouter } from './users/users.routes.js';
import { invitesRouter, workspacesRouter } from './workspaces/workspaces.routes.js';

export const apiRouter = Router();

apiRouter.use((_req, _res, next) => {
  if (Number(mongoose.connection.readyState) !== 1) return next(dependencyUnavailable('database'));
  next();
});

apiRouter.use(rateLimit({ tier: 'global', limit: env.RATE_LIMIT_GLOBAL }));

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/workspaces', workspacesRouter);
apiRouter.use('/invites', invitesRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/', boardsRouter);
apiRouter.use('/', cardsRouter);
apiRouter.use('/', pagesRouter);
apiRouter.use('/', chatRouter);
apiRouter.use('/', searchRouter);
apiRouter.use('/', analyticsRouter);
apiRouter.use('/', filesRouter);
apiRouter.use('/admin', adminQueuesRouter);

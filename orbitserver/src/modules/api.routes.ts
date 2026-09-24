/**
 * /api/v1 router — mounts every module (vertical slices).
 * Global rate limit applies to the whole business API.
 */
import mongoose from 'mongoose';
import { dependencyUnavailable } from '../infrastructure/errors/ApiError.js';
import { Router } from 'express';
import { env } from '../config/env.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { authRouter } from './auth/auth.routes.js';
import { boardsRouter } from './boards/boards.routes.js';
import { cardsRouter } from './cards/cards.routes.js';
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
apiRouter.use('/', boardsRouter);
apiRouter.use('/', cardsRouter);

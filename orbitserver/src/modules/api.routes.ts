/**
 * /api/v1 router — mounts every module (vertical slices).
 * Global rate limit applies to the whole business API.
 */
import { Router } from 'express';
import { env } from '../config/env.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { authRouter } from './auth/auth.routes.js';
import { boardsRouter } from './boards/boards.routes.js';
import { cardsRouter } from './cards/cards.routes.js';
import { invitesRouter, workspacesRouter } from './workspaces/workspaces.routes.js';

export const apiRouter = Router();

apiRouter.use(rateLimit({ tier: 'global', limit: env.RATE_LIMIT_GLOBAL }));

apiRouter.use('/auth', authRouter);
apiRouter.use('/workspaces', workspacesRouter);
apiRouter.use('/invites', invitesRouter);
apiRouter.use('/', boardsRouter);
apiRouter.use('/', cardsRouter);

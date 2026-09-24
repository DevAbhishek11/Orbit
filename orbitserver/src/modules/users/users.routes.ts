/**
 * User routes — the signed-in user's own profile.
 * Self-service only: role/status live on the workspace membership and are
 * changed through /workspaces/:wid/members/:userId instead.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './users.controller.js';
import { updateProfileSchema } from './users.schema.js';

export const usersRouter = Router();

const writeLimit = rateLimit({ tier: 'write' });

usersRouter.use(authenticate());

usersRouter.get('/me', controller.getMe);
usersRouter.patch('/me', writeLimit, validate({ body: updateProfileSchema }), controller.updateMe);

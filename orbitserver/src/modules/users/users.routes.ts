import express, { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './users.controller.js';
import { updateProfileSchema } from './users.schema.js';

export const usersRouter = Router();

const writeLimit = rateLimit({ tier: 'write' });

usersRouter.get('/avatars/:fileName', controller.serveAvatar);

usersRouter.use(authenticate());

usersRouter.get('/me', controller.getMe);
usersRouter.patch('/me', writeLimit, validate({ body: updateProfileSchema }), controller.updateMe);

usersRouter.post(
  '/me/avatar',
  rateLimit({ tier: 'upload' }),
  express.raw({ type: ['image/*'], limit: '2mb' }),
  controller.uploadAvatar,
);

usersRouter.delete('/me/avatar', writeLimit, controller.deleteAvatar);

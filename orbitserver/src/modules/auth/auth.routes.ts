import { Router } from 'express';
import { env } from '../../config/env.js';
import { idempotency } from '../../middleware/idempotency.js';
import { authKeyFor, rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import * as controller from './auth.controller.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  switchWorkspaceSchema,
  verifyEmailSchema,
} from './auth.schema.js';

export const authRouter = Router();

const authRateLimit = rateLimit({
  tier: 'auth',
  keyFor: authKeyFor,
  limit: env.RATE_LIMIT_AUTH,
  failClosed: true,
});

const ipRateLimit = rateLimit({
  tier: 'auth',
  limit: env.RATE_LIMIT_AUTH,
  failClosed: true,
});

authRouter.post(
  '/register',
  authRateLimit,
  validate({ body: registerSchema }),
  idempotency(),
  controller.register,
);

authRouter.post('/login', authRateLimit, validate({ body: loginSchema }), controller.login);

authRouter.post('/refresh', ipRateLimit, validate({ body: refreshSchema }), controller.refresh);

authRouter.post(
  '/logout',
  authenticate({ required: false }),
  validate({ body: logoutSchema }),
  controller.logout,
);

authRouter.post(
  '/forgot-password',
  authRateLimit,
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword,
);

authRouter.post(
  '/reset-password',
  ipRateLimit,
  validate({ body: resetPasswordSchema }),
  controller.resetPassword,
);

authRouter.post(
  '/change-password',
  authenticate(),
  authRateLimit,
  validate({ body: changePasswordSchema }),
  controller.changePassword,
);

authRouter.post(
  '/verify-email',
  ipRateLimit,
  validate({ body: verifyEmailSchema }),
  controller.verifyEmail,
);

authRouter.post(
  '/switch-workspace',
  authenticate(),
  ipRateLimit,
  validate({ body: switchWorkspaceSchema }),
  controller.switchWorkspace,
);

authRouter.get('/sessions', authenticate(), controller.sessions);

authRouter.delete('/sessions/:familyId', authenticate(), controller.revokeSession);

authRouter.get('/me', authenticate(), controller.me);

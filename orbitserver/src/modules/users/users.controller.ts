import type { Request, Response } from 'express';
import { ok } from '../../infrastructure/http/response.js';
import { requireAuth } from '../../middleware/authenticate.js';
import * as service from './users.service.js';
import type { UpdateProfileInput } from './users.schema.js';

export async function getMe(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  ok(res, await service.getProfile(auth.userId));
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  ok(res, await service.updateProfile(auth.userId, req.body as UpdateProfileInput));
}

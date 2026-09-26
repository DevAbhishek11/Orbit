import fs from 'node:fs';
import type { Request, Response } from 'express';
import { validationFailed } from '../../infrastructure/errors/ApiError.js';
import { ok } from '../../infrastructure/http/response.js';
import { removeAvatar, resolveAvatarPath, saveAvatar } from './avatars.service.js';
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

export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const body = req.body as unknown;
  if (!Buffer.isBuffer(body)) {
    throw validationFailed([{ path: 'file', message: 'Expected raw image bytes in the body' }]);
  }
  const mimeType = (req.header('content-type') ?? '').split(';')[0]!.trim();
  const avatarUrl = saveAvatar(auth.userId, mimeType, body);
  ok(res, await service.updateProfile(auth.userId, { avatarUrl }));
}

export async function deleteAvatar(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  removeAvatar(auth.userId);
  ok(res, await service.updateProfile(auth.userId, { avatarUrl: null }));
}

export function serveAvatar(req: Request, res: Response): void {
  const resolved = resolveAvatarPath(String(req.params.fileName ?? ''));
  if (!resolved) {
    res
      .status(404)
      .json({ success: false, error: { code: 'NOT_FOUND', message: 'Avatar not found' } });
    return;
  }
  res.setHeader('Content-Type', resolved.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  fs.createReadStream(resolved.filePath).pipe(res);
}

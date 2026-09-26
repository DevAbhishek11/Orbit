import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { validationFailed } from '../../infrastructure/errors/ApiError.js';

export const AVATAR_DIR = path.resolve(process.cwd(), 'uploads', 'avatars');
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

function ensureDir(): void {
  if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

export function isSupportedAvatarMime(mimeType: string): boolean {
  return Boolean(EXTENSION_BY_MIME[mimeType.toLowerCase()]);
}

export function saveAvatar(userId: string, mimeType: string, data: Buffer): string {
  const ext = EXTENSION_BY_MIME[mimeType.toLowerCase()];
  if (!ext) {
    throw validationFailed([
      { path: 'file', message: 'Avatar must be a PNG, JPEG, GIF or WebP image' },
    ]);
  }
  if (data.length === 0) {
    throw validationFailed([{ path: 'file', message: 'Avatar file is empty' }]);
  }
  if (data.length > MAX_AVATAR_BYTES) {
    throw validationFailed([{ path: 'file', message: 'Avatar must be 2 MB or smaller' }]);
  }

  ensureDir();
  for (const stale of listAvatarFilesFor(userId)) {
    fs.rmSync(path.join(AVATAR_DIR, stale), { force: true });
  }

  const fileName = `${userId}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(AVATAR_DIR, fileName), data);
  return `/api/v1/users/avatars/${fileName}`;
}

export function listAvatarFilesFor(userId: string): string[] {
  if (!fs.existsSync(AVATAR_DIR)) return [];
  return fs.readdirSync(AVATAR_DIR).filter((name) => name.startsWith(`${userId}-`));
}

export function resolveAvatarPath(fileName: string): { filePath: string; mimeType: string } | null {
  if (!/^[a-f0-9]{24}-[a-f0-9]{12}\.(jpg|png|gif|webp)$/i.test(fileName)) return null;
  const filePath = path.join(AVATAR_DIR, fileName);
  if (!filePath.startsWith(AVATAR_DIR + path.sep)) return null;
  if (!fs.existsSync(filePath)) return null;
  const ext = fileName.split('.').pop()!.toLowerCase();
  return { filePath, mimeType: MIME_BY_EXTENSION[ext] ?? 'application/octet-stream' };
}

export function removeAvatar(userId: string): void {
  for (const stale of listAvatarFilesFor(userId)) {
    fs.rmSync(path.join(AVATAR_DIR, stale), { force: true });
  }
}

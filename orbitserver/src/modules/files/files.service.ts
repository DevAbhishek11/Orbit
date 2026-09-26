import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { notFound, validationFailed } from '../../infrastructure/errors/ApiError.js';
import { enqueue } from '../../infrastructure/queues/index.js';
import { emitSafe } from '../../infrastructure/events/eventBus.js';
import * as repo from './files.repository.js';
import type { FileDoc } from './files.model.js';
import type { PresignInput } from './files.schema.js';

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/zip',
  'video/mp4',
  'audio/mpeg',
]);

function generateS3Key(workspaceId: string, fileName: string): string {
  const ext = fileName.split('.').pop() ?? '';
  const random = crypto.randomBytes(8).toString('hex');
  const date = new Date().toISOString().slice(0, 10);
  return `${workspaceId}/${date}/${random}${ext ? `.${ext}` : ''}`;
}

export async function presignUpload(
  workspaceId: string,
  input: PresignInput,
  actorId: string,
): Promise<{ file: FileDoc; uploadUrl: string; s3Key: string }> {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw validationFailed([
      { path: 'mimeType', message: `MIME type ${input.mimeType} not allowed` },
    ]);
  }

  const ext = input.fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'exe' || ext === 'bat' || ext === 'sh' || ext === 'js') {
    throw validationFailed([{ path: 'fileName', message: 'Executable files are not allowed' }]);
  }

  const s3Key = generateS3Key(workspaceId, input.fileName);

  const file = await repo.createFile({
    workspaceId,
    uploadedBy: actorId,
    fileName: `${crypto.randomUUID()}-${input.fileName}`,
    originalName: input.fileName,
    mimeType: input.mimeType,
    size: input.size,
    s3Key,
    s3Bucket: 'orbit-files',
    status: 'pending',
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
  });

  const finalUploadUrl = `/api/v1/files/${file._id.toString()}/raw`;

  return { file, uploadUrl: finalUploadUrl, s3Key };
}

export async function saveLocalFileStream(
  workspaceId: string,
  fileId: string,
  readable: NodeJS.ReadableStream,
): Promise<FileDoc> {
  const file = await repo.findFileByIdScoped(fileId, workspaceId);
  if (!file) throw notFound('File');

  const targetDir = path.join(LOCAL_STORAGE_DIR, workspaceId);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const safeFileName = `${file._id.toString()}-${path.basename(file.originalName)}`;
  const destinationPath = path.join(targetDir, safeFileName);
  const writeStream = fs.createWriteStream(destinationPath);

  await new Promise<void>((resolve, reject) => {
    readable.pipe(writeStream);
    writeStream.on('finish', () => resolve());
    writeStream.on('error', (err) => reject(err));
  });

  const updated = await repo.updateFileById(fileId, {
    status: 'ready',
  });

  if (!updated) throw notFound('File');

  if (updated.mimeType.startsWith('image/')) {
    void enqueue('files', 'process-upload', {
      fileId: updated._id.toString(),
      workspaceId,
      mimeType: updated.mimeType,
    });
  }

  emitSafe(`workspace:${workspaceId}`, 'file:ready', {
    fileId: updated._id.toString(),
    fileName: updated.originalName,
    mimeType: updated.mimeType,
  });

  return updated;
}

export async function getLocalFilePath(
  workspaceId: string,
  fileId: string,
): Promise<{ filePath: string; file: FileDoc }> {
  const file = await repo.findFileByIdScoped(fileId, workspaceId);
  if (!file || file.status === 'deleted') throw notFound('File');

  const targetDir = path.join(LOCAL_STORAGE_DIR, workspaceId);
  const safeFileName = `${file._id.toString()}-${path.basename(file.originalName)}`;
  const filePath = path.join(targetDir, safeFileName);

  return { filePath, file };
}

export async function confirmUpload(
  fileId: string,
  workspaceId: string,
  checksum?: string,
): Promise<FileDoc> {
  const file = await repo.findFileByIdScoped(fileId, workspaceId);
  if (!file) throw notFound('File');

  if (file.status === 'ready') return file;

  const updated = await repo.updateFileById(fileId, {
    status: 'ready',
    checksum: checksum ?? null,
  });

  if (!updated) throw notFound('File');

  if (updated.mimeType.startsWith('image/')) {
    void enqueue('files', 'process-upload', {
      fileId: updated._id.toString(),
      workspaceId,
      mimeType: updated.mimeType,
    });
  }

  emitSafe(`workspace:${workspaceId}`, 'file:ready', {
    fileId: updated._id.toString(),
    fileName: updated.originalName,
    mimeType: updated.mimeType,
  });

  return updated;
}

export async function getFile(fileId: string, workspaceId: string): Promise<FileDoc> {
  const file = await repo.findFileByIdScoped(fileId, workspaceId);
  if (!file || file.status === 'deleted') throw notFound('File');
  return file;
}

export async function deleteFile(fileId: string, workspaceId: string): Promise<void> {
  const file = await repo.findFileByIdScoped(fileId, workspaceId);
  if (!file) throw notFound('File');

  await repo.deleteFileById(fileId);

  try {
    const targetDir = path.join(LOCAL_STORAGE_DIR, workspaceId);
    const safeFileName = `${file._id.toString()}-${path.basename(file.originalName)}`;
    const destinationPath = path.join(targetDir, safeFileName);
    if (fs.existsSync(destinationPath)) {
      await fs.promises.unlink(destinationPath).catch(() => undefined);
    }
  } catch (_err) {
    void _err;
  }

  void enqueue('cleanup', 'purge-orphan-file', {
    fileId,
    workspaceId,
  });
}

export async function listFilesByEntity(
  workspaceId: string,
  entityType: string,
  entityId: string,
): Promise<FileDoc[]> {
  return repo.findFilesByEntity(workspaceId, entityType, entityId);
}

export async function listFiles(workspaceId: string): Promise<FileDoc[]> {
  return repo.findFilesByWorkspace(workspaceId);
}

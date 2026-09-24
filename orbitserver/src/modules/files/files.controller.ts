/**
 * Files controller — HTTP plumbing only.
 */
import type { Request, Response } from 'express';
import { created, noContent, ok } from '../../infrastructure/http/response.js';
import { requireAuth } from '../../middleware/authenticate.js';
import * as service from './files.service.js';
import type { PresignInput, ConfirmInput } from './files.schema.js';

export async function presign(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const result = await service.presignUpload(
    auth.workspaceId!,
    req.body as PresignInput,
    auth.userId,
  );
  created(res, {
    file: {
      id: result.file._id.toString(),
      fileName: result.file.originalName,
      mimeType: result.file.mimeType,
      size: result.file.size,
      status: result.file.status,
      s3Key: result.s3Key,
    },
    uploadUrl: result.uploadUrl,
  });
}

export async function confirm(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const body = req.body as ConfirmInput;
  const file = await service.confirmUpload(String(req.params.id), auth.workspaceId!, body.checksum);
  ok(res, {
    file: {
      id: file._id.toString(),
      fileName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      status: file.status,
    },
  });
}

export async function getFile(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const file = await service.getFile(String(req.params.id), auth.workspaceId!);
  ok(res, {
    file: {
      id: file._id.toString(),
      fileName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      status: file.status,
      s3Key: file.s3Key,
      uploadedBy: file.uploadedBy,
      createdAt: file.createdAt,
    },
  });
}

export async function deleteFile(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  await service.deleteFile(String(req.params.id), auth.workspaceId!);
  noContent(res);
}

export async function rawUploadPlaceholder(req: Request, res: Response): Promise<void> {
  // In dev, this endpoint accepts raw upload and immediately confirms
  // In production, uploads go directly to S3 via presigned URL
  const auth = requireAuth(req);
  const file = await service.confirmUpload(String(req.params.id), auth.workspaceId!);
  ok(res, {
    file: {
      id: file._id.toString(),
      fileName: file.originalName,
      status: file.status,
    },
    message: 'File upload confirmed (dev mode — S3 presign bypassed)',
  });
}

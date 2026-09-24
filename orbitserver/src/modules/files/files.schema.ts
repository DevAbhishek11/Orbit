/**
 * Zod validation schemas for Files module.
 */
import { z } from 'zod';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export const presignSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().min(1).max(100 * 1024 * 1024), // 100MB max
  entityType: z.enum(['card', 'page', 'message']).optional(),
  entityId: objectId.optional(),
});

export const confirmSchema = z.object({
  checksum: z.string().max(128).optional(),
});

export const fileParamsSchema = z.object({
  id: objectId,
});

export type PresignInput = z.infer<typeof presignSchema>;
export type ConfirmInput = z.infer<typeof confirmSchema>;

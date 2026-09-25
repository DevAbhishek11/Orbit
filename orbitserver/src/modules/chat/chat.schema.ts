import { z } from 'zod';
import { CONTENT } from '@orbit/shared';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export const createChannelSchema = z.object({
  name: z.string().trim().min(1).max(80),
  topic: z.string().max(250).optional().default(''),
  type: z.enum(['public', 'private', 'dm']).default('public'),
  memberIds: z.array(objectId).optional().default([]),
});

export const updateChannelSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  topic: z.string().max(250).optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(CONTENT.MESSAGE_BODY_MAX),
  clientId: z.string().max(64).optional(),
  parentId: objectId.optional().nullable(),
  fileIds: z.array(objectId).optional().default([]),
});

export const editMessageSchema = z.object({
  body: z.string().trim().min(1).max(CONTENT.MESSAGE_BODY_MAX),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});

export const channelParamsSchema = z.object({
  id: objectId,
});

export const messageParamsSchema = z.object({
  id: objectId,
});

export const widParamsSchema = z.object({
  wid: objectId,
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;

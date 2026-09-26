import { z } from 'zod';
import { CONTENT } from '@orbit/shared';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

const pageBlockSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum([
    'paragraph',
    'h1',
    'h2',
    'h3',
    'bullet',
    'numbered',
    'todo',
    'quote',
    'code',
    'divider',
    'callout',
  ]),
  content: z.string().max(CONTENT.BLOCK_TEXT_MAX).default(''),
  order: z.string().min(1).max(64),
  checked: z.boolean().optional(),
  language: z.string().max(32).optional(),
});

export const createPageSchema = z.object({
  title: z.string().trim().min(1).max(CONTENT.PAGE_TITLE_MAX),
  icon: z.string().max(16).optional().nullable(),
  cover: z.string().url().max(1000).optional().nullable(),
  parentId: objectId.optional().nullable(),
  visibility: z.enum(['workspace', 'private', 'link']).optional(),
});

export const updatePageSchema = z.object({
  version: z.number().int().min(1),
  title: z.string().trim().min(1).max(CONTENT.PAGE_TITLE_MAX).optional(),
  icon: z.string().max(16).optional().nullable(),
  cover: z.string().url().max(1000).optional().nullable(),
  blocks: z.array(pageBlockSchema).max(CONTENT.BLOCKS_PER_PAGE).optional(),
  parentId: objectId.optional().nullable(),
  order: z.string().max(64).optional(),
  visibility: z.enum(['workspace', 'private', 'link']).optional(),
});

export const pageParamsSchema = z.object({
  id: objectId,
});

export const pageVersionParamsSchema = z.object({
  id: objectId,
  versionId: objectId,
});

export const widParamsSchema = z.object({
  wid: objectId,
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

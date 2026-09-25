import { z } from 'zod';
import { CONTENT } from '@orbit/shared';

export const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const orderKey = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[0-9A-Za-z]+$/, 'Order key must be base-62');

export const cursorQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().max(200).optional(),
});

export const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2_000).optional(),
  visibility: z.enum(['workspace', 'private']).default('workspace'),
  memberIds: z.array(objectId).max(200).optional(),
  background: z.string().max(40).optional(),
});

export const updateBoardSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2_000).nullable().optional(),
    visibility: z.enum(['workspace', 'private']).optional(),
    memberIds: z.array(objectId).max(200).optional(),
    background: z.string().max(40).nullable().optional(),
    archivedAt: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

export const boardParamsSchema = z.object({ id: objectId });
export const widParamsSchema = z.object({ wid: objectId });

export const createListSchema = z.object({
  name: z.string().trim().min(1).max(120),
  color: z.string().max(20).optional(),
  wipLimit: z.number().int().min(1).max(500).nullable().optional(),
});

export const updateListSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    color: z.string().max(20).nullable().optional(),
    wipLimit: z.number().int().min(1).max(500).nullable().optional(),
    archivedAt: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

export const reorderListsSchema = z.object({
  boardId: objectId,

  listIds: z.array(objectId).min(1).max(50),
});

export const listParamsSchema = z.object({ id: objectId });

export const deleteListQuerySchema = z.object({
  force: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional()
    .default(false),
});

export const labelSchema = z
  .object({
    id: z.string().min(1).max(20),
    name: z.string().min(1).max(40),
    color: z.string().min(1).max(20),
  })
  .strict();

export const checklistItemSchema = z
  .object({
    id: z.string().min(1).max(20),
    title: z.string().min(1).max(200),
    done: z.boolean().default(false),
  })
  .strict();

export const checklistSchema = z
  .object({
    id: z.string().min(1).max(20),
    title: z.string().min(1).max(200),
    items: z.array(checklistItemSchema).max(CONTENT.CHECKLIST_ITEMS).default([]),
  })
  .strict();

export const createCardSchema = z.object({
  title: z.string().trim().min(1).max(CONTENT.CARD_TITLE_MAX),
  description: z.string().max(CONTENT.CARD_DESCRIPTION_MAX).optional(),
  labels: z.array(labelSchema).max(CONTENT.LABELS_PER_CARD).optional(),
  checklists: z.array(checklistSchema).max(CONTENT.CHECKLISTS_PER_CARD).optional(),
  assignees: z.array(objectId).max(50).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  startAt: z.coerce.date().nullable().optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  coverColor: z.string().max(20).nullable().optional(),

  beforeCardId: objectId.nullable().optional(),
  sourceMessageId: objectId.optional(),
  pageId: objectId.optional(),
  clientMutationId: z.string().max(64).optional(),
});

export const updateCardSchema = z
  .object({
    version: z.number().int().min(1),
    title: z.string().trim().min(1).max(CONTENT.CARD_TITLE_MAX).optional(),
    description: z.string().max(CONTENT.CARD_DESCRIPTION_MAX).nullable().optional(),
    labels: z.array(labelSchema).max(CONTENT.LABELS_PER_CARD).optional(),
    checklists: z.array(checklistSchema).max(CONTENT.CHECKLISTS_PER_CARD).optional(),
    assignees: z.array(objectId).max(50).optional(),
    dueAt: z.coerce.date().nullable().optional(),
    startAt: z.coerce.date().nullable().optional(),
    priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
    coverColor: z.string().max(20).nullable().optional(),
    completed: z.boolean().optional(),
    archivedAt: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1, 'Provide at least one field besides version');

export const moveCardSchema = z
  .object({
    version: z.number().int().min(1),
    targetListId: objectId,

    beforeCardId: objectId.nullable().optional(),
    afterCardId: objectId.nullable().optional(),
    clientMutationId: z.string().max(64).optional(),
  })
  .strict();

export const cardParamsSchema = z.object({ id: objectId });

export const listCardsQuerySchema = cursorQuerySchema.extend({
  listId: objectId.optional(),
  assignee: objectId.optional(),
  label: z.string().max(20).optional(),
  due: z.enum(['overdue', 'today', 'week']).optional(),
  q: z.string().min(1).max(120).optional(),
  completed: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  includeArchived: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
});

export const boardCardsParamsSchema = z.object({ id: objectId });

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(CONTENT.COMMENT_MAX),
  clientMutationId: z.string().max(64).optional(),
});

export const createCardFromMessageSchema = z.object({
  messageId: objectId,
  boardId: objectId,
  listId: objectId.optional(),
  title: z.string().trim().min(1).max(CONTENT.CARD_TITLE_MAX).optional(),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type ReorderListsInput = z.infer<typeof reorderListsSchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
export type ListCardsQuery = z.infer<typeof listCardsQuerySchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type CreateCardFromMessageInput = z.infer<typeof createCardFromMessageSchema>;

import { z } from 'zod';

const INVITABLE_ROLES = ['admin', 'manager', 'member', 'viewer'] as const;

export const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9-]+$/, 'Slug may contain lowercase letters, digits and hyphens');

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(120),
  slug: slugSchema,
  timezone: z.string().max(64).optional(),
});

export const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: slugSchema.optional(),
    logoUrl: z.string().url().max(2048).nullable().optional(),
    settings: z
      .object({
        timezone: z.string().max(64).optional(),
        weekStart: z.union([z.literal(0), z.literal(1)]).optional(),
        defaultRole: z.enum(['member', 'viewer']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(INVITABLE_ROLES),
});

export const inviteTokenSchema = z.object({
  token: z.string().min(20).max(200),
});

export const updateMemberSchema = z
  .object({
    role: z.enum(INVITABLE_ROLES).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  })
  .strict()
  .refine((v) => v.role !== undefined || v.status !== undefined, 'Provide role and/or status');

export const transferOwnershipSchema = z.object({
  toUserId: objectId,
  confirm: z.string().min(1),
});

export const deleteWorkspaceSchema = z.object({
  confirm: z.string().min(1),
});

export const listMembersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

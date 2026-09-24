/**
 * User endpoint contracts (Zod — single source of truth).
 * Only the fields a user may change about themselves are exposed here;
 * status/role/tokenVersion are admin- or system-controlled and stay out.
 */
import { z } from 'zod';

export const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const preferencesSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    quietHoursStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm')
      .nullable()
      .optional(),
    quietHoursEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm')
      .nullable()
      .optional(),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120).optional(),
    timezone: z.string().min(1).max(64).optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
    preferences: preferencesSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

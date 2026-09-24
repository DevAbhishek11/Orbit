/**
 * Auth endpoint contracts (Zod = single source of truth, BUILD_PROMPT rule 4).
 */
import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .email('Must be a valid email address');

/** Password policy length floor — full policy runs in the service (context-aware). */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters');

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/, 'Handle may contain lowercase letters, digits and underscores');

export const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, 'Name is required').max(120),
  handle: handleSchema.optional(),
  timezone: z.string().max(64).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(256),
  remember: z.boolean().optional().default(false),
  workspaceId: objectId.optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200).optional(),
  workspaceId: objectId.optional(),
});

export const logoutSchema = z.object({
  allDevices: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional()
    .default(false),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(200),
});

export const switchWorkspaceSchema = z.object({
  workspaceId: objectId,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

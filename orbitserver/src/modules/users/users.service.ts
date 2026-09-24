/**
 * Users service — self-service profile. Business logic only (no req/res).
 * Every mutation is audited, and preference patches merge field-by-field so a
 * partial update can never wipe the rest of the sub-document.
 */
import { notFound } from '../../infrastructure/errors/ApiError.js';
import { recordAudit } from '../audit/audit.service.js';
import { toPublicUser, type UserDoc } from './users.model.js';
import { findUserById, updateUserProfile } from './users.repository.js';
import type { UpdateProfileInput } from './users.schema.js';

export async function getProfile(userId: string): Promise<Record<string, unknown>> {
  const user = await findUserById(userId);
  if (!user) throw notFound('User');
  return toPublicUser(user);
}

/** Flatten a preferences patch into `preferences.<key>` dotted paths. */
function buildProfileUpdate(input: UpdateProfileInput): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.timezone !== undefined) update.timezone = input.timezone;
  if (input.avatarUrl !== undefined) update.avatarUrl = input.avatarUrl;
  for (const [key, value] of Object.entries(input.preferences ?? {})) {
    if (value !== undefined) update[`preferences.${key}`] = value;
  }
  return update;
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<Record<string, unknown>> {
  const existing = await findUserById(userId);
  if (!existing) throw notFound('User');

  const update = buildProfileUpdate(input);
  const updated: UserDoc | null = await updateUserProfile(userId, update);
  if (!updated) throw notFound('User');

  await recordAudit({
    actorId: userId,
    action: 'user.profile.update',
    entityType: 'user',
    entityId: userId,
    after: { fields: Object.keys(update) },
  });
  return toPublicUser(updated);
}

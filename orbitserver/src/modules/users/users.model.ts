/**
 * User model (BUILD_PROMPT Phase 3).
 *  - email: unique + lowercased, partial index (deleted users free the email)
 *  - passwordHash: select:false — only auth flows may hydrate it
 *  - tokenVersion: bumping it invalidates every issued access token
 *  - lockout fields power the login brute-force defence
 */
import { Schema, model, type Model, type Types } from 'mongoose';
import {
  softDeletePlugin,
  type SoftDeleteFields,
  type SoftDeleteQueryHelpers,
  type SoftDeleteStatics,
} from '../../plugins/softDelete.js';

export type UserStatus = 'pending' | 'active' | 'suspended' | 'deleted';

export interface IUserPreferences {
  theme: 'light' | 'dark' | 'system';
  emailNotifications: boolean;
  pushNotifications: boolean;
  quietHoursStart?: string; // 'HH:mm' in the user's timezone
  quietHoursEnd?: string;
}

export interface IUser extends SoftDeleteFields {
  email: string;
  passwordHash: string;
  name: string;
  handle: string;
  timezone: string;
  avatarUrl?: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  tokenVersion: number;
  preferences: IUserPreferences;
  failedLoginCount: number;
  lockedUntil: Date | null;
  verificationTokenHash?: string | null;
  verificationTokenExpiresAt?: Date | null;
  resetTokenHash?: string | null;
  resetTokenExpiresAt?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    handle: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_]+$/,
    },
    timezone: { type: String, default: 'UTC' },
    avatarUrl: { type: String, maxlength: 2048 },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'deleted'],
      default: 'pending',
      index: true,
    },
    emailVerifiedAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      quietHoursStart: { type: String },
      quietHoursEnd: { type: String },
    },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    verificationTokenHash: { type: String, default: null, select: false },
    verificationTokenExpiresAt: { type: Date, default: null, select: false },
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpiresAt: { type: Date, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
  },
  {
    collection: 'users',
    timestamps: true,
  },
);

// Unique email among non-deleted users (partial index keeps the hot path small).
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
userSchema.index({ handle: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
// Unified search over people (Phase 11 uses this for suggestions/mentions).
userSchema.index({ name: 'text', email: 'text', handle: 'text' });

softDeletePlugin(userSchema);

export const UserModel = model<
  IUser,
  Model<IUser, SoftDeleteQueryHelpers> & SoftDeleteStatics
>(
  'User',
  userSchema,
);

/** A stored user document — repositories always return this shape. */
export type UserDoc = IUser & { _id: Types.ObjectId };

/** Public projection — everything a client may ever see about a user. */
export function toPublicUser(user: UserDoc): Record<string, unknown> {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    handle: user.handle,
    timezone: user.timezone,
    avatarUrl: user.avatarUrl ?? null,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    preferences: user.preferences,
    createdAt: user.createdAt,
  };
}

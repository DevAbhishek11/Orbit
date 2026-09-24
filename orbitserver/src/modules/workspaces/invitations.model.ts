/**
 * Invitations (BUILD_PROMPT Phase 5): single-use, hashed at rest, 72 h TTL.
 */
import { Schema, model } from 'mongoose';
import type { Role } from '@orbit/shared';

export interface IInvitation {
  workspaceId: string;
  email: string;
  role: Role;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  createdAt: Date;
}

const invitationSchema = new Schema<IInvitation>(
  {
    workspaceId: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ['admin', 'manager', 'member', 'viewer'],
      default: 'member',
    },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
  },
  { collection: 'invitations', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
invitationSchema.index({ workspaceId: 1, email: 1 });

export const InvitationModel = model<IInvitation>('Invitation', invitationSchema);

import { Schema, model } from 'mongoose';
import type { Role } from '@orbit/shared';

export type MemberStatus = 'active' | 'suspended';

export interface IWorkspaceMember {
  workspaceId: string;
  userId: string;
  role: Role;
  status: MemberStatus;
  invitedBy?: string;
  joinedAt: Date;
  notificationPrefs: {
    email: boolean;
    push: boolean;
    mentionsOnly: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<IWorkspaceMember>(
  {
    workspaceId: { type: String, required: true },
    userId: { type: String, required: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'manager', 'member', 'viewer'],
      default: 'member',
    },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    invitedBy: { type: String },
    joinedAt: { type: Date, default: () => new Date() },
    notificationPrefs: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      mentionsOnly: { type: Boolean, default: false },
    },
  },
  { collection: 'workspace_members', timestamps: true, versionKey: false },
);

memberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
memberSchema.index({ userId: 1, status: 1 });
memberSchema.index({ workspaceId: 1, role: 1 });

export const WorkspaceMemberModel = model<IWorkspaceMember>('WorkspaceMember', memberSchema);

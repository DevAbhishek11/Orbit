/**
 * Notifications model (BUILD_PROMPT Phase 11).
 */
import mongoose, { type Document, Schema } from 'mongoose';

export interface NotificationDoc extends Document {
  workspaceId: string;
  userId: string;
  actorId?: string | null;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  entityType?: 'card' | 'page' | 'channel' | 'workspace' | null;
  entityId?: string | null;
  groupKey?: string | null;
  groupCount: number;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<NotificationDoc>(
  {
    workspaceId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    actorId: { type: String, default: null },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: null },
    entityType: { type: String, enum: ['card', 'page', 'channel', 'workspace', null], default: null },
    entityId: { type: String, default: null },
    groupKey: { type: String, default: null },
    groupCount: { type: Number, default: 1 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'notifications' },
);

NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, groupKey: 1, createdAt: -1 });

export const NotificationModel = mongoose.model<NotificationDoc>('Notification', NotificationSchema);

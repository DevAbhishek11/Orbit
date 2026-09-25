import { Schema, model } from 'mongoose';

export type ActivityEntityType = 'board' | 'list' | 'card' | 'page' | 'message' | 'workspace';

export interface IActivity {
  workspaceId: string;
  entityType: ActivityEntityType;
  entityId: string;
  actorId: string;
  action: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    workspaceId: { type: String, required: true },
    entityType: {
      type: String,
      required: true,
      enum: ['board', 'list', 'card', 'page', 'message', 'workspace'],
    },
    entityId: { type: String, required: true },
    actorId: { type: String, required: true },
    action: { type: String, required: true, maxlength: 60 },
    meta: {
      type: Schema.Types.Mixed,
      validate: (v: unknown) => v === undefined || JSON.stringify(v).length <= 4_000,
    },
    createdAt: { type: Date, default: () => new Date(), immutable: true },
  },
  { collection: 'activities', timestamps: false, versionKey: false },
);

activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

activitySchema.index({ workspaceId: 1, createdAt: -1 });

export const ActivityModel = model<IActivity>('Activity', activitySchema);

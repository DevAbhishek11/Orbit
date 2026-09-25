import { Schema, model } from 'mongoose';
import { RETENTION } from '@orbit/shared';

export interface IAuditLog {
  workspaceId?: string;
  actorId: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  at: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    workspaceId: { type: String, index: true },
    actorId: { type: String, required: true, index: true },
    actorRole: { type: String },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String },

    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String, maxlength: 400 },
    requestId: { type: String },
    at: { type: Date, default: () => new Date(), immutable: true },
  },
  {
    collection: 'auditlogs',
    versionKey: false,
    timestamps: false,
  },
);

auditLogSchema.index({ workspaceId: 1, at: -1 });
auditLogSchema.index({ actorId: 1, at: -1 });
auditLogSchema.index({ action: 1, at: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, at: -1 });
auditLogSchema.index({ at: 1 }, { expireAfterSeconds: RETENTION.AUDIT_TTL_DAYS * 86_400 });

export const AuditLogModel = model<IAuditLog>('AuditLog', auditLogSchema);

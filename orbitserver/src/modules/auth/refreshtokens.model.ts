import { Schema, model } from 'mongoose';

export interface IRefreshToken {
  userId: string;
  tokenHash: string;
  familyId: string;
  device?: string;
  userAgent?: string;
  ip?: string;
  expiresAt: Date;
  createdAt: Date;
  rotatedAt?: Date | null;
  replacedBy?: string | null;
  revokedAt?: Date | null;
  revokedReason?: string | null;
  lastUsedAt?: Date | null;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    device: { type: String, maxlength: 120 },
    userAgent: { type: String, maxlength: 400 },
    ip: { type: String, maxlength: 64 },
    expiresAt: { type: Date, required: true },
    rotatedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
    lastUsedAt: { type: Date, default: null },
  },
  {
    collection: 'refreshtokens',
    timestamps: true,
    versionKey: false,
  },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1, createdAt: -1 });

export const RefreshTokenModel = model<IRefreshToken>('RefreshToken', refreshTokenSchema);

import mongoose, { type Document, Schema } from 'mongoose';

export interface FileDoc extends Document {
  workspaceId: string;
  uploadedBy: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  s3Key: string;
  s3Bucket: string;
  status: 'pending' | 'ready' | 'quarantined' | 'deleted';
  entityType?: 'card' | 'page' | 'message' | null;
  entityId?: string | null;
  checksum?: string | null;
  thumbnailKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema = new Schema<FileDoc>(
  {
    workspaceId: { type: String, required: true, index: true },
    uploadedBy: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    s3Key: { type: String, required: true },
    s3Bucket: { type: String, required: true, default: 'orbit-files' },
    status: {
      type: String,
      enum: ['pending', 'ready', 'quarantined', 'deleted'],
      default: 'pending',
      index: true,
    },
    entityType: { type: String, enum: ['card', 'page', 'message', null], default: null },
    entityId: { type: String, default: null },
    checksum: { type: String, default: null },
    thumbnailKey: { type: String, default: null },
  },
  { timestamps: true, collection: 'files' },
);

FileSchema.index({ workspaceId: 1, entityType: 1, entityId: 1 });
FileSchema.index({ workspaceId: 1, status: 1 });

export const FileModel = mongoose.model<FileDoc>('File', FileSchema);

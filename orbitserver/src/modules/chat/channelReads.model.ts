import mongoose, { type Document, Schema } from 'mongoose';

export interface ChannelReadDoc extends Document {
  workspaceId: string;
  channelId: string;
  userId: string;
  lastReadAt: Date;
  lastReadMessageId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelReadSchema = new Schema<ChannelReadDoc>(
  {
    workspaceId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    lastReadAt: { type: Date, default: Date.now },
    lastReadMessageId: { type: String, default: null },
  },
  { timestamps: true, collection: 'channel_reads' },
);

ChannelReadSchema.index({ channelId: 1, userId: 1 }, { unique: true });

export const ChannelReadModel = mongoose.model<ChannelReadDoc>('ChannelRead', ChannelReadSchema);

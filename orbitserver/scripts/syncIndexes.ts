import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { logger } from '../src/infrastructure/logger/index.js';
import { ActivityModel } from '../src/modules/activities/activities.model.js';
import { AuditLogModel } from '../src/modules/audit/auditlogs.model.js';
import { RefreshTokenModel } from '../src/modules/auth/refreshtokens.model.js';
import { BoardModel } from '../src/modules/boards/boards.model.js';
import { ListModel } from '../src/modules/boards/lists.model.js';
import { CardModel } from '../src/modules/cards/cards.model.js';
import { CommentModel } from '../src/modules/comments/comments.model.js';
import { PageModel } from '../src/modules/pages/pages.model.js';
import { PageVersionModel } from '../src/modules/pages/pageversions.model.js';
import { ChannelModel } from '../src/modules/chat/channels.model.js';
import { MessageModel } from '../src/modules/chat/messages.model.js';
import { ChannelReadModel } from '../src/modules/chat/channelReads.model.js';
import { NotificationModel } from '../src/modules/notifications/notifications.model.js';
import { FileModel } from '../src/modules/files/files.model.js';
import { UserModel } from '../src/modules/users/users.model.js';
import { InvitationModel } from '../src/modules/workspaces/invitations.model.js';
import { WorkspaceMemberModel } from '../src/modules/workspaces/workspaceMembers.model.js';
import { WorkspaceModel } from '../src/modules/workspaces/workspaces.model.js';

const MODELS = [
  UserModel,
  WorkspaceModel,
  WorkspaceMemberModel,
  InvitationModel,
  BoardModel,
  ListModel,
  CardModel,
  PageModel,
  PageVersionModel,
  ChannelModel,
  MessageModel,
  ChannelReadModel,
  NotificationModel,
  FileModel,
  CommentModel,
  ActivityModel,
  AuditLogModel,
  RefreshTokenModel,
] as const;

async function main(): Promise<void> {
  logger.info({ dbName: env.MONGO_DB_NAME }, 'connecting to MongoDB to sync indexes');
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGO_DB_NAME,
    serverSelectionTimeoutMS: env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    autoIndex: false,
  });

  let failed = 0;
  for (const model of MODELS) {
    try {
      await model.createIndexes();
      const indexes = await model.listIndexes();
      logger.info({ collection: model.collection.name, indexes: indexes.length }, 'indexes synced');
    } catch (err) {
      failed += 1;
      logger.error({ collection: model.collection.name, err }, 'index sync FAILED');
    }
  }

  await mongoose.disconnect();
  if (failed > 0) {
    logger.error({ failed }, 'finished with failures');
    process.exit(1);
  }
  logger.info('all indexes synced');
  process.exit(0);
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'sync-indexes crashed');
  process.exit(1);
});

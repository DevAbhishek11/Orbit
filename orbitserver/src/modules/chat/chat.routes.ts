/**
 * Chat routes (BUILD_PROMPT Phase 8 — Slack pillar).
 */
import { Router, type Request } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize, type ScopeDescriptor } from '../../middleware/authorize.js';
import { idempotency } from '../../middleware/idempotency.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { findChannelById, findChannelByIdScoped } from './chat.repository.js';
import * as controller from './chat.controller.js';
import {
  channelParamsSchema,
  createChannelSchema,
  editMessageSchema,
  messageParamsSchema,
  reactionSchema,
  sendMessageSchema,
  updateChannelSchema,
  widParamsSchema,
} from './chat.schema.js';

export const chatRouter = Router();

const writeLimit = rateLimit({ tier: 'write' });

async function loadChannel(req: Request): Promise<ScopeDescriptor | null> {
  const auth = req.auth!;
  const channel =
    (await findChannelByIdScoped(String(req.params.id), auth.workspaceId ?? '')) ??
    (await findChannelById(String(req.params.id)));
  if (!channel) return null;
  return {
    workspaceId: channel.workspaceId,
    createdBy: channel.createdBy,
    visibility: channel.type === 'public' ? 'workspace' : 'private',
    memberIds: channel.memberIds,
  };
}

// Workspace channels collection
chatRouter.post(
  '/workspaces/:wid/channels',
  authenticate(),
  writeLimit,
  validate({ params: widParamsSchema, body: createChannelSchema }),
  idempotency(),
  authorize('channel:create', { workspaceParam: 'wid' }),
  controller.createChannel,
);

chatRouter.get(
  '/workspaces/:wid/channels',
  authenticate(),
  validate({ params: widParamsSchema }),
  authorize('channel:read', { workspaceParam: 'wid' }),
  controller.listChannels,
);

// Channel item & messages
chatRouter.get(
  '/channels/:id',
  authenticate(),
  validate({ params: channelParamsSchema }),
  authorize('channel:read', { load: loadChannel }),
  controller.getChannel,
);

chatRouter.patch(
  '/channels/:id',
  authenticate(),
  writeLimit,
  validate({ params: channelParamsSchema, body: updateChannelSchema }),
  authorize('channel:update', { load: loadChannel }),
  controller.updateChannel,
);

chatRouter.delete(
  '/channels/:id',
  authenticate(),
  writeLimit,
  validate({ params: channelParamsSchema }),
  authorize('channel:delete', { load: loadChannel }),
  controller.deleteChannel,
);

chatRouter.get(
  '/channels/:id/messages',
  authenticate(),
  validate({ params: channelParamsSchema }),
  authorize('channel:read', { load: loadChannel }),
  controller.listMessages,
);

chatRouter.post(
  '/channels/:id/messages',
  authenticate(),
  writeLimit,
  validate({ params: channelParamsSchema, body: sendMessageSchema }),
  idempotency(),
  authorize('message:send', { load: loadChannel }),
  controller.sendMessage,
);

chatRouter.post(
  '/channels/:id/read',
  authenticate(),
  validate({ params: channelParamsSchema }),
  authorize('channel:read', { load: loadChannel }),
  controller.markRead,
);

// Message item operations (reactions, edit, delete, thread)
chatRouter.patch(
  '/messages/:id',
  authenticate(),
  writeLimit,
  validate({ params: messageParamsSchema, body: editMessageSchema }),
  controller.editMessage,
);

chatRouter.delete(
  '/messages/:id',
  authenticate(),
  writeLimit,
  validate({ params: messageParamsSchema }),
  controller.deleteMessage,
);

chatRouter.post(
  '/messages/:id/reactions',
  authenticate(),
  validate({ params: messageParamsSchema, body: reactionSchema }),
  controller.toggleReaction,
);

chatRouter.get(
  '/messages/:id/thread',
  authenticate(),
  validate({ params: messageParamsSchema }),
  controller.getThread,
);

import type { Request, Response } from 'express';
import { created, noContent, ok } from '../../infrastructure/http/response.js';
import { requireAuth } from '../../middleware/authenticate.js';
import * as service from './chat.service.js';
import type {
  CreateChannelInput,
  EditMessageInput,
  ReactionInput,
  SendMessageInput,
  UpdateChannelInput,
} from './chat.schema.js';

export async function createChannel(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const wid = String(req.params.wid);
  const result = await service.createChannel(wid, req.body as CreateChannelInput, auth.userId);
  created(res, { channel: result });
}

export async function listChannels(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const wid = String(req.params.wid || auth.workspaceId);
  const channels = await service.listChannels(wid, auth.userId);
  ok(res, { channels });
}

export async function getChannel(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const channel = await service.getChannel(String(req.params.id), auth.workspaceId!);
  ok(res, { channel });
}

export async function updateChannel(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const channel = await service.updateChannel(
    String(req.params.id),
    auth.workspaceId!,
    req.body as UpdateChannelInput,
  );
  ok(res, { channel });
}

export async function deleteChannel(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  await service.deleteChannel(String(req.params.id), auth.workspaceId!);
  noContent(res);
}

export async function listMessages(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const query = req.query as { limit?: string; before?: string };
  const limit = Math.min(Number(query.limit ?? 50) || 50, 100);
  const messages = await service.listMessages(
    String(req.params.id),
    auth.workspaceId!,
    limit,
    query.before,
  );
  ok(res, { messages });
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const message = await service.sendMessage(
    String(req.params.id),
    auth.workspaceId!,
    req.body as SendMessageInput,
    auth.userId,
  );
  created(res, { message });
}

export async function editMessage(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const body = req.body as EditMessageInput;
  const message = await service.editMessage(
    String(req.params.id),
    auth.workspaceId!,
    body.body,
    auth.userId,
  );
  ok(res, { message });
}

export async function deleteMessage(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  await service.deleteMessage(String(req.params.id), auth.workspaceId!, auth.userId);
  noContent(res);
}

export async function toggleReaction(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const body = req.body as ReactionInput;
  const message = await service.toggleReaction(
    String(req.params.id),
    auth.workspaceId!,
    body.emoji,
    auth.userId,
  );
  ok(res, { message });
}

export async function getThread(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const thread = await service.getThread(String(req.params.id), auth.workspaceId!);
  ok(res, thread);
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const body = req.body as { messageId?: string } | undefined;
  await service.markChannelRead(
    String(req.params.id),
    auth.workspaceId!,
    auth.userId,
    body?.messageId,
  );
  noContent(res);
}

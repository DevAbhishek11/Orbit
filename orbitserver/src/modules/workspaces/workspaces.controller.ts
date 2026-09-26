import type { Request, Response } from 'express';
import { created, noContent, ok } from '../../infrastructure/http/response.js';
import { requireAuth } from '../../middleware/authenticate.js';
import { loadUserOr404 } from './workspaces.service.js';
import * as service from './workspaces.service.js';
import type {
  CreateWorkspaceInput,
  InviteInput,
  TransferOwnershipInput,
  UpdateMemberInput,
  UpdateWorkspaceInput,
} from './workspaces.schema.js';

export async function createWorkspace(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const result = await service.createWorkspaceWithBootstrap(req.body as CreateWorkspaceInput, {
    userId: auth.userId,
  });
  created(res, result);
}

export async function listWorkspaces(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const workspaces = await service.listMyWorkspaces(auth.userId);
  ok(res, { workspaces });
}

export async function getWorkspace(req: Request, res: Response): Promise<void> {
  ok(res, await service.getWorkspace(String(req.params.wid)));
}

export async function updateWorkspace(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const result = await service.updateWorkspaceSettings(
    String(req.params.wid),
    req.body as UpdateWorkspaceInput,
    {
      userId: auth.userId,
      role: auth.role as never,
    },
  );
  ok(res, result);
}

export async function deleteWorkspace(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const body = req.body as { confirm?: string };
  await service.archiveOrDeleteWorkspace(String(req.params.wid), body.confirm ?? '', {
    userId: auth.userId,
    role: auth.role as never,
  });
  noContent(res);
}

export async function listMembers(req: Request, res: Response): Promise<void> {
  const query = req.query as { limit?: string };
  const limit = Math.min(Number(query.limit ?? 200) || 200, 200);
  ok(res, { members: await service.listMembersWithProfiles(String(req.params.wid), limit) });
}

export async function updateMember(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const result = await service.updateMember(
    String(req.params.wid),
    String(req.params.userId),
    req.body as UpdateMemberInput,
    {
      userId: auth.userId,
      role: auth.role as never,
    },
  );
  ok(res, result);
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  await service.removeMemberFromWorkspace(String(req.params.wid), String(req.params.userId), {
    userId: auth.userId,
    role: auth.role as never,
  });
  noContent(res);
}

export async function leaveWorkspace(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  await service.leaveWorkspace(String(req.params.wid), auth.userId);
  noContent(res);
}

export async function transferOwnership(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  await service.transferOwnership(String(req.params.wid), req.body as TransferOwnershipInput, {
    userId: auth.userId,
    role: 'owner',
  });
  ok(res, { transferred: true });
}

export async function inviteMember(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const result = await service.inviteMember(String(req.params.wid), req.body as InviteInput, {
    userId: auth.userId,
    role: auth.role as never,
  });
  created(res, result);
}

export async function listInvites(req: Request, res: Response): Promise<void> {
  ok(res, { invites: await service.listInvitations(String(req.params.wid)) });
}

export async function acceptInvite(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const user = await loadUserOr404(auth.userId);
  const result = await service.acceptInvite(String(req.params.token), {
    userId: auth.userId,
    email: user.email,
  });
  ok(res, result);
}

export async function declineInvite(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const user = await loadUserOr404(auth.userId);
  await service.declineInvite(String(req.params.token), { email: user.email });
  noContent(res);
}

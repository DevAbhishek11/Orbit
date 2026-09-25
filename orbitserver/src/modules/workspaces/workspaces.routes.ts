import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { idempotency } from '../../middleware/idempotency.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './workspaces.controller.js';
import {
  createWorkspaceSchema,
  deleteWorkspaceSchema,
  inviteSchema,
  listMembersQuerySchema,
  objectId,
  transferOwnershipSchema,
  updateMemberSchema,
  updateWorkspaceSchema,
} from './workspaces.schema.js';
import { z } from 'zod';

export const workspacesRouter = Router();
export const invitesRouter = Router();

const widParams = z.object({ wid: objectId });
const memberParams = z.object({ wid: objectId, userId: objectId });
const tokenParams = z.object({ token: z.string().min(20).max(200) });

const writeLimit = rateLimit({ tier: 'write' });

workspacesRouter.use(authenticate());

workspacesRouter.post(
  '/',
  writeLimit,
  validate({ body: createWorkspaceSchema }),
  idempotency(),
  controller.createWorkspace,
);
workspacesRouter.get('/', controller.listWorkspaces);

workspacesRouter.get(
  '/:wid',
  validate({ params: widParams }),
  authorize('workspace:members:read'),
  controller.getWorkspace,
);
workspacesRouter.patch(
  '/:wid',
  writeLimit,
  validate({ params: widParams, body: updateWorkspaceSchema }),
  authorize('workspace:update'),
  controller.updateWorkspace,
);
workspacesRouter.delete(
  '/:wid',
  validate({ params: widParams, body: deleteWorkspaceSchema }),
  authorize('workspace:delete'),
  controller.deleteWorkspace,
);
workspacesRouter.post(
  '/:wid/transfer-ownership',
  validate({ params: widParams, body: transferOwnershipSchema }),
  authorize('workspace:transfer'),
  controller.transferOwnership,
);
workspacesRouter.post('/:wid/leave', validate({ params: widParams }), controller.leaveWorkspace);

workspacesRouter.get(
  '/:wid/members',
  validate({ params: widParams, query: listMembersQuerySchema }),
  authorize('workspace:members:read'),
  controller.listMembers,
);
workspacesRouter.patch(
  '/:wid/members/:userId',
  writeLimit,
  validate({ params: memberParams, body: updateMemberSchema }),
  authorize('workspace:members:update'),
  controller.updateMember,
);
workspacesRouter.delete(
  '/:wid/members/:userId',
  writeLimit,
  validate({ params: memberParams }),
  authorize('workspace:members:remove'),
  controller.removeMember,
);

workspacesRouter.get(
  '/:wid/invites',
  validate({ params: widParams }),
  authorize('workspace:invite', { workspaceParam: 'wid' }),
  controller.listInvites,
);
workspacesRouter.post(
  '/:wid/invites',
  writeLimit,
  validate({ params: widParams, body: inviteSchema }),
  idempotency(),
  authorize('workspace:invite', { workspaceParam: 'wid' }),
  controller.inviteMember,
);
invitesRouter.use(authenticate());
invitesRouter.post(
  '/:token/accept',
  writeLimit,
  validate({ params: tokenParams }),
  controller.acceptInvite,
);
invitesRouter.post(
  '/:token/decline',
  writeLimit,
  validate({ params: tokenParams }),
  controller.declineInvite,
);

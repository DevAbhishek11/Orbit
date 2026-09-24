/**
 * Workspaces service (BUILD_PROMPT Phase 5).
 *
 * T1 — workspace bootstrap (ONE transaction):
 *   workspace + owner membership + "Getting Started" board + 3 lists + audit.
 *   Injected failures roll everything back (proven by tests).
 *
 * Invite/accept flows enforce seat limits, dedupe, hashed single-use tokens
 * and LAST_OWNER_PROTECTED rules. Membership changes invalidate the caches so
 * permission changes apply within one request.
 */
import { createHash, randomBytes } from 'node:crypto';
import { firstKey, incrementKey, RoleRank, WORKSPACE, type Role } from '@orbit/shared';
import { env } from '../../config/env.js';
import { runInTransaction } from '../../infrastructure/db/transaction.js';
import {
  ApiError,
  forbiddenRole,
  inviteExpired,
  lastOwnerProtected,
  notFound,
  seatLimitReached,
  duplicate,
} from '../../infrastructure/errors/ApiError.js';
import { emitSafe } from '../../infrastructure/events/eventBus.js';
import { childLogger } from '../../infrastructure/logger/index.js';
import { sendMail } from '../../infrastructure/mail/mailer.js';
import { invalidateMembershipCache } from '../../middleware/authorize.js';
import { recordAudit } from '../audit/audit.service.js';
import { createBoard, createList } from '../boards/boards.repository.js';
import { pruneAssignee } from '../cards/cards.repository.js';
import { findUserByEmail, findUserById, findUsersByIds } from '../users/users.repository.js';
import type { UserDoc } from '../users/users.model.js';
import {
  countMembers,
  countOwners,
  createInvitation,
  createMember,
  createWorkspace,
  findInvitationByTokenHash,
  findInvitationsByWorkspace,
  findMembership,
  findMembers,
  findMembershipsByUser,
  findPendingInvite,
  findPrimaryMembership,
  findWorkspaceById,
  findWorkspaceBySlug,
  markInvitationAccepted,
  markInvitationDeclined,
  removeMember,
  setMemberStatus,
  type MemberDoc,
  updateMemberRole,
  updateWorkspace,
  incWorkspaceStats,
} from './workspaces.repository.js';
import { invalidateAuthSnapshot } from '../../middleware/authenticate.js';
import { getOrSet, invalidateTag } from '../../infrastructure/cache/cacheService.js';
import type {
  CreateWorkspaceInput,
  InviteInput,
  TransferOwnershipInput,
  UpdateMemberInput,
  UpdateWorkspaceInput,
} from './workspaces.schema.js';

const log = childLogger({ module: 'workspaces' });

const WORKSPACE_LIST_CACHE_TTL = 60;

export type { MemberDoc };

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

// ── T1: transactional bootstrap ───────────────────────────────────────

export async function createWorkspaceWithBootstrap(
  input: CreateWorkspaceInput,
  owner: { userId: string; email?: string },
): Promise<Record<string, unknown>> {
  if (await findWorkspaceBySlug(input.slug)) {
    throw duplicate('This workspace slug is already taken');
  }

  const result = await runInTransaction(
    async (tx) => {
      const workspace = await createWorkspace(
        {
          name: input.name,
          slug: input.slug,
          createdBy: owner.userId,
          settings: { timezone: input.timezone ?? 'UTC', weekStart: 1, defaultRole: 'member' },
          stats: { memberCount: 1, boardCount: 1, pageCount: 0, channelCount: 0 },
        },
        tx.session,
      );
      tx.compensate(async () => {
        const { WorkspaceModel } = await import('./workspaces.model.js');
      await WorkspaceModel.deleteOne({ _id: workspace._id }).exec();
      });

      await createMember(
        {
          workspaceId: String(workspace._id),
          userId: owner.userId,
          role: 'owner',
          status: 'active',
        },
        tx.session,
      );
      tx.compensate(async () => {
        await removeMember(String(workspace._id), owner.userId);
      });

      // Default board with three lists — step 4 of T1 (rollback-test target).
      const board = await createBoard(
        {
          workspaceId: String(workspace._id),
          name: 'Getting Started',
          description: 'Your first Orbit board — drag cards between lists.',
          createdBy: owner.userId,
          stats: { listCount: 3, cardCount: 0 },
        },
        tx.session,
      );

      let order: string | null = null;
      for (const name of ['To Do', 'In Progress', 'Done']) {
        order = order === null ? firstKey() : incrementKey(order);
        await createList(
          { workspaceId: String(workspace._id), boardId: String(board._id), name, order },
          tx.session,
        );
      }

      await recordAudit({
        actorId: owner.userId,
        actorRole: 'owner',
        action: 'workspace.create',
        entityType: 'workspace',
        entityId: String(workspace._id),
        workspaceId: String(workspace._id),
        after: { name: workspace.name, slug: workspace.slug },
        session: tx.session,
      });

      return { workspace, boardId: String(board._id) };
    },
    { name: 'T1-workspace-bootstrap' },
  );

  // AFTER commit: caches + events (never inside the transaction).
  await invalidateTag(`user:${owner.userId}:workspaces`);
  emitSafe(`workspace:${String(result.workspace._id)}`, 'workspace:created', {
    workspaceId: String(result.workspace._id),
  });

  return {
    id: String(result.workspace._id),
    name: result.workspace.name,
    slug: result.workspace.slug,
    role: 'owner',
    boardId: result.boardId,
    createdAt: result.workspace.createdAt,
  };
}

// ── listing (cached) ──────────────────────────────────────────────────

export async function listMyWorkspaces(userId: string): Promise<unknown[]> {
  return getOrSet(
    `user:${userId}:workspaces`,
    async () => {
      const memberships = await findMembershipsByUser(userId);
      const results: unknown[] = [];
      for (const membership of memberships) {
        const workspace = await findWorkspaceById(membership.workspaceId);
        if (!workspace || workspace.archivedAt) continue;
        results.push({
          id: membership.workspaceId,
          name: workspace.name,
          slug: workspace.slug,
          logoUrl: workspace.logoUrl ?? null,
          role: membership.role,
          stats: workspace.stats,
          joinedAt: membership.joinedAt,
        });
      }
      return results;
    },
    { ttlSeconds: WORKSPACE_LIST_CACHE_TTL, tags: [`user:${userId}:workspaces`] },
  );
}

// ── read / update / archive / delete ──────────────────────────────────

export async function getWorkspace(workspaceId: string): Promise<Record<string, unknown>> {
  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) throw notFound('Workspace');
  return {
    id: String(workspace._id),
    name: workspace.name,
    slug: workspace.slug,
    logoUrl: workspace.logoUrl ?? null,
    plan: workspace.plan,
    seatLimit: workspace.seatLimit,
    settings: workspace.settings,
    stats: workspace.stats,
    archivedAt: workspace.archivedAt,
    createdAt: workspace.createdAt,
  };
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  input: UpdateWorkspaceInput,
  actor: { userId: string; role: Role },
): Promise<Record<string, unknown>> {
  if (input.slug && (await findWorkspaceBySlug(input.slug))) {
    const current = await findWorkspaceById(workspaceId);
    if (!current || current.slug !== input.slug) throw duplicate('This workspace slug is already taken');
  }
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.slug !== undefined) update.slug = input.slug;
  if (input.logoUrl !== undefined) update.logoUrl = input.logoUrl;
  if (input.settings !== undefined) {
    // MERGE, never replace: `$set: { settings: {...} }` overwrites the whole
    // sub-document, so a partial patch (e.g. only `timezone`) would silently
    // drop weekStart/defaultRole — Mongoose applies defaults on insert only.
    const current = await findWorkspaceById(workspaceId);
    if (!current) throw notFound('Workspace');
    update.settings = { ...current.settings, ...input.settings };
  }

  const updated = await updateWorkspace(workspaceId, update);
  if (!updated) throw notFound('Workspace');
  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'workspace.update',
    entityType: 'workspace',
    entityId: workspaceId,
    workspaceId,
    after: update,
  });
  // Per-user workspace lists expire within their 60 s TTL; the actor sees it now.
  await invalidateTag(`user:${actor.userId}:workspaces`);
  return getWorkspace(workspaceId);
}

export async function archiveOrDeleteWorkspace(
  workspaceId: string,
  confirmSlug: string,
  actor: { userId: string; role: Role },
): Promise<void> {
  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) throw notFound('Workspace');
  if (workspace.slug !== confirmSlug) {
    throw new ApiError('VALIDATION_ERROR', 'Confirmation slug does not match the workspace', { status: 422 });
  }
  await updateWorkspace(workspaceId, { deletedAt: new Date(), deletedBy: actor.userId, archivedAt: new Date() });
  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'workspace.delete',
    entityType: 'workspace',
    entityId: workspaceId,
    workspaceId,
    before: { name: workspace.name, slug: workspace.slug },
  });
}

// ── members ───────────────────────────────────────────────────────────

export async function listMembersWithProfiles(
  workspaceId: string,
  limit: number,
): Promise<unknown[]> {
  const members = await findMembers(workspaceId, limit);
  const users = await findUsersByIds(members.map((m) => m.userId));
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return members.map((m) => {
    const user = byId.get(m.userId);
    return {
      userId: m.userId,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      invitedBy: m.invitedBy ?? null,
      name: user?.name ?? 'Unknown user',
      email: user?.email ?? null,
      handle: user?.handle ?? null,
      avatarUrl: user?.avatarUrl ?? null,
    };
  });
}

export async function updateMember(
  workspaceId: string,
  targetUserId: string,
  input: UpdateMemberInput,
  actor: { userId: string; role: Role },
): Promise<{ userId: string; role: Role; status: string }> {
  const target = await findMembership(workspaceId, targetUserId);
  if (!target) throw notFound('Member');

  if (input.role && input.role !== target.role) {
    if (target.role === 'owner') throw lastOwnerProtected();
    // Nobody edits their own role — ownership moves only via transfer-ownership,
    // and a self-service role change would be a privilege-escalation shortcut.
    if (actor.userId === targetUserId) {
      throw forbiddenRole('You cannot change your own role — ask another owner or admin');
    }
    if (RoleRank[actor.role] <= RoleRank[target.role]) {
      throw forbiddenRole('You cannot change the role of an equal or higher-ranked member');
    }
    await updateMemberRole(workspaceId, targetUserId, input.role);
  }
  if (input.status && input.status !== target.status) {
    if (target.role === 'owner') throw lastOwnerProtected();
    if (RoleRank[actor.role] <= RoleRank[target.role]) throw forbiddenRole();
    await setMemberStatus(workspaceId, targetUserId, input.status);
  }

  await invalidateMembershipCache(workspaceId, targetUserId);
  await invalidateTag(`user:${targetUserId}:workspaces`);
  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'workspace.member.update',
    entityType: 'workspace_member',
    entityId: targetUserId,
    workspaceId,
    before: { role: target.role, status: target.status },
    after: { role: input.role ?? target.role, status: input.status ?? target.status },
  });
  emitSafe(`workspace:${workspaceId}`, 'workspace:member:changed', {
    userId: targetUserId,
    workspaceId,
  });

  const fresh = await findMembership(workspaceId, targetUserId);
  return { userId: targetUserId, role: fresh!.role, status: fresh!.status };
}

export async function removeMemberFromWorkspace(
  workspaceId: string,
  targetUserId: string,
  actor: { userId: string; role: Role },
): Promise<void> {
  const target = await findMembership(workspaceId, targetUserId);
  if (!target) throw notFound('Member');
  if (target.role === 'owner') {
    if ((await countOwners(workspaceId)) <= 1) throw lastOwnerProtected();
    throw forbiddenRole('Owners must transfer ownership before removal');
  }
  if (actor.userId !== targetUserId && RoleRank[actor.role] <= RoleRank[target.role]) {
    throw forbiddenRole('You cannot remove an equal or higher-ranked member');
  }

  // T4: remove membership + decrement stats + prune card assignments + audit.
  await runInTransaction(
    async (tx) => {
      await removeMember(workspaceId, targetUserId, tx.session);
      tx.compensate(async () => {
        // Compensation runs AFTER the failed transaction — fresh session-less write.
        await createMember({ workspaceId, userId: targetUserId, role: target.role, status: target.status });
      });
      await incWorkspaceStats(workspaceId, { memberCount: -1 }, tx.session);
      await pruneAssignee(workspaceId, targetUserId, tx.session);
      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'workspace.member.remove',
        entityType: 'workspace_member',
        entityId: targetUserId,
        workspaceId,
        before: { role: target.role },
        session: tx.session,
      });
    },
    { name: 'T4-remove-member' },
  );

  await invalidateMembershipCache(workspaceId, targetUserId);
  await invalidateTag(`user:${targetUserId}:workspaces`);
  emitSafe(`workspace:${workspaceId}`, 'workspace:member:changed', {
    userId: targetUserId,
    workspaceId,
    removed: true,
  });
}

export async function leaveWorkspace(
  workspaceId: string,
  userId: string,
): Promise<void> {
  const membership = await findMembership(workspaceId, userId);
  if (!membership) throw notFound('Membership');
  if (membership.role === 'owner' && (await countOwners(workspaceId)) <= 1) {
    throw lastOwnerProtected();
  }
  await runInTransaction(
    async (tx) => {
      await removeMember(workspaceId, userId, tx.session);
      await incWorkspaceStats(workspaceId, { memberCount: -1 }, tx.session);
      await pruneAssignee(workspaceId, userId, tx.session);
      await recordAudit({
        actorId: userId,
        action: 'workspace.leave',
        entityType: 'workspace',
        entityId: workspaceId,
        workspaceId,
        session: tx.session,
      });
    },
    { name: 'leave-workspace' },
  );
  await invalidateMembershipCache(workspaceId, userId);
  await invalidateTag(`user:${userId}:workspaces`);
}

export async function transferOwnership(
  workspaceId: string,
  input: TransferOwnershipInput,
  actor: { userId: string; role: Role },
): Promise<void> {
  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) throw notFound('Workspace');
  if (workspace.slug !== input.confirm) {
    throw new ApiError('VALIDATION_ERROR', 'Confirmation must match the workspace slug', { status: 422 });
  }
  const target = await findMembership(workspaceId, input.toUserId);
  if (!target) throw notFound('Member');

  await runInTransaction(
    async (tx) => {
      await updateMemberRole(workspaceId, actor.userId, 'admin', tx.session);
      tx.compensate(async () => {
        await updateMemberRole(workspaceId, actor.userId, 'owner');
      });
      await updateMemberRole(workspaceId, input.toUserId, 'owner', tx.session);
      await recordAudit({
        actorId: actor.userId,
        actorRole: 'owner',
        action: 'workspace.transfer_ownership',
        entityType: 'workspace',
        entityId: workspaceId,
        workspaceId,
        before: { owner: actor.userId },
        after: { owner: input.toUserId },
        session: tx.session,
      });
    },
    { name: 'transfer-ownership' },
  );

  await invalidateMembershipCache(workspaceId, actor.userId);
  await invalidateMembershipCache(workspaceId, input.toUserId);
  await invalidateAuthSnapshot(actor.userId);
  await invalidateAuthSnapshot(input.toUserId);
  emitSafe(`workspace:${workspaceId}`, 'workspace:member:changed', { workspaceId, transferred: true });
}

// ── invitations ───────────────────────────────────────────────────────

export async function inviteMember(
  workspaceId: string,
  input: InviteInput,
  actor: { userId: string; role: Role },
): Promise<{
  invited: true;
  email: string;
  role: string;
  expiresAt: Date;
  acceptToken?: string;
}> {
  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) throw notFound('Workspace');

  if (RoleRank[input.role] >= RoleRank[actor.role]) throw forbiddenRole('You can only invite a lower-ranked role');
  const memberCount = await countMembers(workspaceId);
  if (memberCount >= workspace.seatLimit) throw seatLimitReached();

  const existingUser = await findUserByEmail(input.email);
  if (existingUser && (await findMembership(workspaceId, String(existingUser._id)))) {
    throw duplicate('This user is already a member of the workspace');
  }
  if (await findPendingInvite(workspaceId, input.email)) {
    throw duplicate('A pending invitation already exists for this email');
  }

  const raw = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + WORKSPACE.INVITE_TTL_HOURS * 3_600 * 1000);
  await createInvitation({
    workspaceId,
    email: input.email,
    role: input.role,
    tokenHash: hashToken(raw),
    invitedBy: actor.userId,
    expiresAt,
  });

  await sendMail({
    to: input.email,
    template: 'workspace_invite',
    subject: `Join ${workspace.name} on ${env.APP_NAME}`,
    vars: { workspace: workspace.name, url: `${env.APP_URL}/invites/${raw}` },
  });
  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'workspace.invite',
    entityType: 'invitation',
    entityId: workspaceId,
    workspaceId,
    after: { email: input.email, role: input.role },
  });

  // The raw token exists ONLY here — the database keeps its SHA-256 hash.
  // SMTP is not wired until the mail queue lands, so outside production we
  // hand the token back to the inviter to keep the invite → accept flow
  // testable end to end. Production returns nothing extra: email is the only
  // delivery channel there.
  const acceptToken = env.NODE_ENV === 'production' ? undefined : raw;

  return { invited: true, email: input.email, role: input.role, expiresAt, acceptToken };
}

/** Invitations for a workspace, with a derived state the UI can render. */
export async function listInvitations(workspaceId: string): Promise<unknown[]> {
  const invitations = await findInvitationsByWorkspace(workspaceId);
  const now = Date.now();
  return invitations.map((invite) => ({
    id: String(invite._id),
    email: invite.email,
    role: invite.role,
    invitedBy: invite.invitedBy,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    state: invite.acceptedAt
      ? 'accepted'
      : invite.declinedAt
        ? 'declined'
        : invite.expiresAt.getTime() <= now
          ? 'expired'
          : 'pending',
  }));
}

/** T6 — accept invite: idempotent, transactional membership upsert. */
export async function acceptInvite(
  token: string,
  user: { userId: string; email: string },
): Promise<{ workspaceId: string; role: Role }> {
  const invitation = await findInvitationByTokenHash(hashToken(token));
  if (!invitation || invitation.expiresAt.getTime() <= Date.now()) throw inviteExpired();
  if (invitation.declinedAt) throw inviteExpired();
  if (invitation.email !== user.email.toLowerCase()) {
    throw forbiddenRole('This invitation was issued to a different email address');
  }

  // Idempotent: double-accept returns the membership, never duplicates it.
  const existing = await findMembership(invitation.workspaceId, user.userId);
  if (existing && invitation.acceptedAt) {
    return { workspaceId: invitation.workspaceId, role: existing.role };
  }

  const workspace = await findWorkspaceById(invitation.workspaceId);
  if (!workspace) throw notFound('Workspace');
  const memberCount = await countMembers(invitation.workspaceId);
  if (memberCount >= workspace.seatLimit) throw seatLimitReached();

  const result = await runInTransaction(
    async (tx) => {
      const accepted = await markInvitationAccepted(String(invitation._id), tx.session);
      if (!accepted && !existing) {
        // Lost a concurrent accept race — re-read the membership.
        const raced = await findMembership(invitation.workspaceId, user.userId, tx.session);
        if (raced) return { workspaceId: invitation.workspaceId, role: raced.role, duplicateAccept: true };
        throw inviteExpired();
      }
      let membership = existing;
      if (!membership) {
        membership = await createMember(
          {
            workspaceId: invitation.workspaceId,
            userId: user.userId,
            role: invitation.role,
            status: 'active',
            invitedBy: invitation.invitedBy,
          },
          tx.session,
        );
        await incWorkspaceStats(invitation.workspaceId, { memberCount: 1 }, tx.session);
      }
      await recordAudit({
        actorId: user.userId,
        action: 'workspace.invite.accepted',
        entityType: 'invitation',
        entityId: invitation.workspaceId,
        workspaceId: invitation.workspaceId,
        after: { email: invitation.email, role: invitation.role },
        session: tx.session,
      });
      return { workspaceId: invitation.workspaceId, role: membership.role, duplicateAccept: false };
    },
    { name: 'T6-accept-invite' },
  );

  await invalidateTag(`user:${user.userId}:workspaces`);
  emitSafe(`workspace:${invitation.workspaceId}`, 'workspace:member:changed', {
    userId: user.userId,
    joined: true,
    workspaceId: invitation.workspaceId,
  });
  log.debug({ workspaceId: result.workspaceId }, 'invite accepted');
  return { workspaceId: result.workspaceId, role: result.role };
}

export async function declineInvite(token: string, user: { email: string }): Promise<void> {
  const invitation = await findInvitationByTokenHash(hashToken(token));
  if (!invitation || invitation.expiresAt.getTime() <= Date.now()) throw inviteExpired();
  if (invitation.email !== user.email.toLowerCase()) {
    throw forbiddenRole('This invitation was issued to a different email address');
  }
  await markInvitationDeclined(String(invitation._id));
}

/** Helper used by auth: the default workspace scope for fresh tokens. */
export async function getDefaultMembership(userId: string): Promise<MemberDoc | null> {
  return findPrimaryMembership(userId);
}

/** Load a user doc (used by controllers to pass email into invite flows). */
export async function loadUserOr404(userId: string): Promise<UserDoc> {
  const user = await findUserById(userId);
  if (!user) throw notFound('User');
  return user;
}

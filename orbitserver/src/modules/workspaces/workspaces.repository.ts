/**
 * Workspaces repository — the only place with workspace/member/invite queries.
 * Every read is workspace-scoped; cross-tenant access answers "not found".
 */
import type { ClientSession, Types } from 'mongoose';
import { WorkspaceModel, type IWorkspace } from './workspaces.model.js';
import { WorkspaceMemberModel, type IWorkspaceMember } from './workspaceMembers.model.js';
import { InvitationModel, type IInvitation } from './invitations.model.js';

export type InvitationDoc = IInvitation & { _id: Types.ObjectId };
export type MemberDoc = IWorkspaceMember & { _id: Types.ObjectId };
export type WorkspaceDoc = IWorkspace & { _id: Types.ObjectId };
import type { Role } from '@orbit/shared';

// ── Workspaces ────────────────────────────────────────────────────────

export async function createWorkspace(
  data: Pick<IWorkspace, 'name' | 'slug' | 'createdBy'> & Partial<IWorkspace>,
  session?: ClientSession,
): Promise<WorkspaceDoc> {
  const [ws] = await WorkspaceModel.create([data], { session });
  return ws!.toObject();
}

export function findWorkspaceById(
  id: string,
  session?: ClientSession,
): Promise<WorkspaceDoc | null> {
  const q = WorkspaceModel.findOne({ _id: id });
  return (session ? q.session(session) : q).lean<WorkspaceDoc>().exec();
}

export function findWorkspaceBySlug(slug: string): Promise<WorkspaceDoc | null> {
  return WorkspaceModel.findOne({ slug: slug.toLowerCase() }).lean<WorkspaceDoc>().exec();
}

export function updateWorkspace(
  id: string,
  update: Record<string, unknown>,
  session?: ClientSession,
): Promise<IWorkspace | null> {
  const q = WorkspaceModel.findOneAndUpdate({ _id: id }, { $set: update }, { new: true });
  return (session ? q.session(session) : q).lean<WorkspaceDoc>().exec();
}

export function incWorkspaceStats(
  id: string,
  delta: Partial<Record<keyof IWorkspace['stats'], number>>,
  session?: ClientSession,
): Promise<unknown> {
  return WorkspaceModel.updateOne({ _id: id }, { $inc: delta }, { session }).exec();
}

// ── Memberships ───────────────────────────────────────────────────────

export async function createMember(
  data: Pick<IWorkspaceMember, 'workspaceId' | 'userId' | 'role'> & Partial<IWorkspaceMember>,
  session?: ClientSession,
): Promise<MemberDoc> {
  const [member] = await WorkspaceMemberModel.create([data], { session });
  return member!.toObject();
}

export function findMembership(
  workspaceId: string,
  userId: string,
  session?: ClientSession,
): Promise<MemberDoc | null> {
  const q = WorkspaceMemberModel.findOne({ workspaceId, userId });
  return (session ? q.session(session) : q).lean<MemberDoc>().exec();
}

export function findMembershipsByUser(userId: string): Promise<MemberDoc[]> {
  return WorkspaceMemberModel.find({ userId, status: 'active' })
    .lean<MemberDoc[]>()
    .exec();
}

export function findMembers(workspaceId: string, limit = 200): Promise<MemberDoc[]> {
  return WorkspaceMemberModel.find({ workspaceId })
    .sort({ joinedAt: 1 })
    .limit(limit)
    .lean<MemberDoc[]>()
    .exec();
}

export function countMembers(workspaceId: string, session?: ClientSession): Promise<number> {
  return WorkspaceMemberModel.countDocuments({ workspaceId, status: 'active' }, { session }).exec();
}

export function countOwners(workspaceId: string, session?: ClientSession): Promise<number> {
  return WorkspaceMemberModel.countDocuments({ workspaceId, role: 'owner' }, { session }).exec();
}

export function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: Role,
  session?: ClientSession,
): Promise<unknown> {
  return WorkspaceMemberModel.updateOne(
    { workspaceId, userId },
    { $set: { role } },
    { session },
  ).exec();
}

export function setMemberStatus(
  workspaceId: string,
  userId: string,
  status: 'active' | 'suspended',
  session?: ClientSession,
): Promise<unknown> {
  return WorkspaceMemberModel.updateOne({ workspaceId, userId }, { $set: { status } }, { session }).exec();
}

export function removeMember(workspaceId: string, userId: string, session?: ClientSession): Promise<unknown> {
  return WorkspaceMemberModel.deleteOne({ workspaceId, userId }, { session }).exec();
}

/** The user's primary workspace membership (first joined) — default token scope. */
export async function findPrimaryMembership(userId: string): Promise<MemberDoc | null> {
  const [first] = await WorkspaceMemberModel.find({ userId, status: 'active' })
    .sort({ joinedAt: 1 })
    .limit(1)
    .lean<MemberDoc[]>()
    .exec();
  return first ?? null;
}

// ── Invitations ───────────────────────────────────────────────────────

export async function createInvitation(
  data: Pick<IInvitation, 'workspaceId' | 'email' | 'role' | 'tokenHash' | 'invitedBy' | 'expiresAt'>,
  session?: ClientSession,
): Promise<InvitationDoc> {
  const [invite] = await InvitationModel.create([data], { session });
  return invite!.toObject();
}

export async function findInvitationByTokenHash(tokenHash: string): Promise<InvitationDoc | null> {
  return (await InvitationModel.findOne({ tokenHash }).lean<InvitationDoc>().exec()) ?? null;
}

export function findPendingInvite(
  workspaceId: string,
  email: string,
): Promise<IInvitation | null> {
  return InvitationModel.findOne({
    workspaceId,
    email: email.toLowerCase(),
    acceptedAt: null,
    declinedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .lean<IInvitation>()
    .exec();
}

export function markInvitationAccepted(invitationId: string, session?: ClientSession): Promise<InvitationDoc | null> {
  const q = InvitationModel.findOneAndUpdate(
    { _id: invitationId, acceptedAt: null, declinedAt: null },
    { $set: { acceptedAt: new Date() } },
    { new: true },
  );
  return (session ? q.session(session) : q).lean<InvitationDoc>().exec();
}

export function markInvitationDeclined(invitationId: string): Promise<InvitationDoc | null> {
  return InvitationModel.findOneAndUpdate(
    { _id: invitationId, acceptedAt: null, declinedAt: null },
    { $set: { declinedAt: new Date() } },
    { new: true },
  )
    .lean<InvitationDoc>()
    .exec();
}

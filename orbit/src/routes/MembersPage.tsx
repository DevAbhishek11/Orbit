/**
 * Members — the workspace roster with role management.
 * The server enforces the hierarchy (you cannot change an equal or higher
 * rank, owners are protected, nobody edits their own role); this page mirrors
 * those rules so the UI does not offer actions the API will reject.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { workspacesApi } from '../api/endpoints';
import type { Member, Role } from '../api/types';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { Avatar, Badge, CenterState, ConfirmDialog, EmptyState, ErrorBox, Spinner } from '../components/ui';

const GRANTABLE: Role[] = ['admin', 'manager', 'member', 'viewer'];
const RANK: Record<Role, number> = { owner: 50, admin: 40, manager: 30, member: 20, viewer: 10 };

export function MembersPage() {
  const { workspaceId, user, role } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [removing, setRemoving] = useState<Member | null>(null);

  const membersQuery = useQuery({
    queryKey: ['members', workspaceId],
    queryFn: () => workspacesApi.members(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const canManageMembers = role === 'owner' || role === 'admin';

  const updateRole = useMutation({
    mutationFn: ({ userId, next }: { userId: string; next: Role }) =>
      workspacesApi.updateMember(workspaceId as string, userId, { role: next }),
    onSuccess: () => {
      toast.success('Role updated');
      void queryClient.invalidateQueries({ queryKey: ['members', workspaceId] });
    },
    onError: (err: ApiError) => toast.error('Could not change role', err.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'active' | 'suspended' }) =>
      workspacesApi.updateMember(workspaceId as string, userId, { status }),
    onSuccess: () => {
      toast.success('Member updated');
      void queryClient.invalidateQueries({ queryKey: ['members', workspaceId] });
    },
    onError: (err: ApiError) => toast.error('Could not update member', err.message),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => workspacesApi.removeMember(workspaceId as string, userId),
    onSuccess: () => {
      toast.success('Member removed');
      setRemoving(null);
      void queryClient.invalidateQueries({ queryKey: ['members', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
    onError: (err: ApiError) => toast.error('Could not remove member', err.message),
  });

  if (!workspaceId) {
    return (
      <div className="page">
        <EmptyState icon="◍" title="No workspace selected" hint="Create or join a workspace first." />
      </div>
    );
  }

  if (membersQuery.isLoading) return <CenterState>Loading members…</CenterState>;

  const members = membersQuery.data?.members ?? [];

  const canEdit = (target: Member): boolean => {
    if (!canManageMembers) return false;
    if (target.userId === user?.id) return false;
    if (target.role === 'owner') return false;
    return RANK[role as Role] > RANK[target.role];
  };

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h1>Members</h1>
          <p className="page__subtitle">{members.length} people in this workspace</p>
        </div>
        <Link className="btn btn--primary" to="/invitations">
          Invite people
        </Link>
      </div>

      {membersQuery.isError ? <ErrorBox message={(membersQuery.error as ApiError).message} /> : null}

      <div className="panel panel--tight" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.userId}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar name={member.name} url={member.avatarUrl} />
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {member.name}
                        {member.userId === user?.id ? <span className="faint"> (you)</span> : null}
                      </div>
                      <div className="faint" style={{ fontSize: 12 }}>
                        {member.email ?? member.handle}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  {canEdit(member) ? (
                    <select
                      className="select"
                      style={{ width: 130 }}
                      value={member.role}
                      disabled={updateRole.isPending}
                      onChange={(event) => updateRole.mutate({ userId: member.userId, next: event.target.value as Role })}
                    >
                      {GRANTABLE.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge tone={member.role === 'owner' ? 'accent' : 'default'}>{member.role}</Badge>
                  )}
                </td>
                <td>
                  <Badge tone={member.status === 'active' ? 'success' : 'warning'}>{member.status}</Badge>
                </td>
                <td className="faint">{new Date(member.joinedAt).toLocaleDateString()}</td>
                <td style={{ textAlign: 'right' }}>
                  {canEdit(member) ? (
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn--sm"
                        disabled={setStatus.isPending}
                        onClick={() =>
                          setStatus.mutate({
                            userId: member.userId,
                            status: member.status === 'active' ? 'suspended' : 'active',
                          })
                        }
                      >
                        {member.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </button>
                      <button type="button" className="btn btn--sm btn--danger" onClick={() => setRemoving(member)}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <span className="faint" style={{ fontSize: 12 }}>
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 ? <EmptyState icon="◍" title="No members yet" /> : null}
      </div>

      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          body="They lose access immediately and are unassigned from every card in this workspace."
          confirmLabel="Remove member"
          danger
          busy={removeMember.isPending}
          onConfirm={() => removeMember.mutate(removing.userId)}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}

export function InvitationsPage() {
  const { workspaceId, workspace, role, refreshWorkspaces } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<Role, 'owner'>>('member');
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const invitesQuery = useQuery({
    queryKey: ['invites', workspaceId],
    queryFn: () => workspacesApi.invites(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const invite = useMutation({
    mutationFn: () => workspacesApi.invite(workspaceId as string, { email, role: inviteRole }),
    onSuccess: (result) => {
      setEmail('');
      setIssuedToken(result.acceptToken ?? null);
      toast.success('Invitation sent', `${result.email} · ${result.role}`);
      void queryClient.invalidateQueries({ queryKey: ['invites', workspaceId] });
    },
    onError: (err: ApiError) => toast.error('Could not invite', err.message),
  });

  if (!workspaceId) {
    return (
      <div className="page">
        <EmptyState icon="✉" title="No workspace selected" hint="Create or join a workspace first." />
      </div>
    );
  }

  const canInvite = role === 'owner' || role === 'admin' || role === 'manager';

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h1>Invitations</h1>
          <p className="page__subtitle">
            {workspace?.name} · free plan seats are limited to the workspace seat limit
          </p>
        </div>
      </div>

      {canInvite ? (
        <div className="panel" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Invite someone</h2>
          <div className="row row--wrap" style={{ alignItems: 'flex-end' }}>
            <div className="grow" style={{ minWidth: 240 }}>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="field__label">Email</span>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@company.com"
                />
              </label>
            </div>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field__label">Role</span>
              <select className="select" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Exclude<Role, 'owner'>)}>
                <option value="admin">admin</option>
                <option value="manager">manager</option>
                <option value="member">member</option>
                <option value="viewer">viewer</option>
              </select>
            </label>
            <button type="button" className="btn btn--primary" disabled={invite.isPending || !email.trim()} onClick={() => invite.mutate()}>
              {invite.isPending ? <Spinner /> : null}
              Send invite
            </button>
          </div>

          {issuedToken ? (
            <div className="info-box" style={{ marginTop: 16 }}>
              <strong>Dev-only accept link</strong> — SMTP is not wired yet, so the API returned the raw
              token instead of emailing it. It is single-use and expires in 72 hours.
              <div className="mono" style={{ marginTop: 6, wordBreak: 'break-all' }}>
                /invites/{issuedToken}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="panel panel--tight" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>State</th>
              <th>Invited</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {(invitesQuery.data?.invites ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.email}</td>
                <td>
                  <Badge>{item.role}</Badge>
                </td>
                <td>
                  <Badge tone={item.state === 'pending' ? 'accent' : item.state === 'accepted' ? 'success' : 'default'}>
                    {item.state}
                  </Badge>
                </td>
                <td className="faint">{new Date(item.createdAt).toLocaleDateString()}</td>
                <td className="faint">{new Date(item.expiresAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {invitesQuery.data && invitesQuery.data.invites.length === 0 ? (
          <EmptyState icon="✉" title="No invitations yet" hint="Invite a teammate to get started." />
        ) : null}
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 8 }}>Already invited somewhere?</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Paste an invite token to accept or decline it.
        </p>
        <div className="row">
          <Link className="btn" to="/accept-invite">
            Open the accept screen
          </Link>
          <button type="button" className="btn btn--ghost" onClick={() => void refreshWorkspaces()}>
            Refresh my workspaces
          </button>
        </div>
      </div>
    </div>
  );
}


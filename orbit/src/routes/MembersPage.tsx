import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailPlus, RefreshCw, UserPlus } from "lucide-react";
import { ApiError } from "../api/client";
import { workspacesApi } from "../api/endpoints";
import type { Member, Role } from "../api/types";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CenterState,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  PageHeader,
  Select,
} from "../components/ui";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

const GRANTABLE: Role[] = ["admin", "manager", "member", "viewer"];
const RANK: Record<Role, number> = {
  owner: 50,
  admin: 40,
  manager: 30,
  member: 20,
  viewer: 10,
};

export function MembersPage() {
  const { workspaceId, user, role } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [removing, setRemoving] = useState<Member | null>(null);

  const membersQuery = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => workspacesApi.members(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const canManageMembers = role === "owner" || role === "admin";

  const updateRole = useMutation({
    mutationFn: ({ userId, next }: { userId: string; next: Role }) =>
      workspacesApi.updateMember(workspaceId as string, userId, { role: next }),
    onSuccess: () => {
      toast.success("Role updated");
      void queryClient.invalidateQueries({
        queryKey: ["members", workspaceId],
      });
    },
    onError: (err: ApiError) =>
      toast.error("Could not change role", err.message),
  });

  const setStatus = useMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: string;
      status: "active" | "suspended";
    }) => workspacesApi.updateMember(workspaceId as string, userId, { status }),
    onSuccess: () => {
      toast.success("Member updated");
      void queryClient.invalidateQueries({
        queryKey: ["members", workspaceId],
      });
    },
    onError: (err: ApiError) =>
      toast.error("Could not update member", err.message),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      workspacesApi.removeMember(workspaceId as string, userId),
    onSuccess: () => {
      toast.success("Member removed");
      setRemoving(null);
      void queryClient.invalidateQueries({
        queryKey: ["members", workspaceId],
      });
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (err: ApiError) =>
      toast.error("Could not remove member", err.message),
  });

  if (!workspaceId) {
    return (
      <EmptyState
        icon={UserPlus}
        title="No workspace selected"
        hint="Create or join a workspace first."
      />
    );
  }

  if (membersQuery.isLoading)
    return <CenterState>Loading members…</CenterState>;

  const members = membersQuery.data?.members ?? [];

  const canEdit = (target: Member): boolean => {
    if (!canManageMembers) return false;
    if (target.userId === user?.id) return false;
    if (target.role === "owner") return false;
    return RANK[role as Role] > RANK[target.role];
  };

  return (
    <div className="mx-auto w-full">
      <PageHeader
        title="Members"
        subtitle={`${members.length} people in this workspace`}
        actions={
          <Link to="/invitations">
            <Button variant="primary" icon={MailPlus}>
              Invite people
            </Button>
          </Link>
        }
      />

      {membersQuery.isError ? (
        <ErrorBox message={(membersQuery.error as ApiError).message} />
      ) : null}

      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[10.5px] font-bold uppercase tracking-wider text-faint">
                <th className="px-4 py-2.5">Person</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Joined</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.userId}
                  className="border-b border-line/60 last:border-0 hover:bg-sunken/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={member.name} url={member.avatarUrl} />
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-bold text-ink">
                          {member.name}
                          {member.userId === user?.id ? (
                            <span className="font-normal text-faint">
                              {" "}
                              (you)
                            </span>
                          ) : null}
                        </div>
                        <div className="truncate text-[11.5px] text-faint">
                          {member.email ?? member.handle}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit(member) ? (
                      <Select
                        value={member.role}
                        disabled={updateRole.isPending}
                        onChange={(event) =>
                          updateRole.mutate({
                            userId: member.userId,
                            next: event.target.value as Role,
                          })
                        }
                        className="w-[124px]"
                        aria-label={`Role for ${member.name}`}
                      >
                        {GRANTABLE.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge
                        tone={member.role === "owner" ? "brand" : "default"}
                      >
                        {member.role}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={member.status === "active" ? "success" : "warning"}
                    >
                      {member.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-faint">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit(member) ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="xs"
                          disabled={setStatus.isPending}
                          onClick={() =>
                            setStatus.mutate({
                              userId: member.userId,
                              status:
                                member.status === "active"
                                  ? "suspended"
                                  : "active",
                            })
                          }
                        >
                          {member.status === "active"
                            ? "Suspend"
                            : "Reactivate"}
                        </Button>
                        <Button
                          size="xs"
                          variant="danger"
                          onClick={() => setRemoving(member)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[12px] text-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {members.length === 0 ? (
          <EmptyState icon={UserPlus} title="No members yet" />
        ) : null}
      </Card>

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
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<Exclude<Role, "owner">>("member");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const invitesQuery = useQuery({
    queryKey: ["invites", workspaceId],
    queryFn: () => workspacesApi.invites(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const invite = useMutation({
    mutationFn: () =>
      workspacesApi.invite(workspaceId as string, { email, role: inviteRole }),
    onSuccess: (result) => {
      setEmail("");
      setIssuedToken(result.acceptToken ?? null);
      toast.success("Invitation sent", `${result.email} · ${result.role}`);
      void queryClient.invalidateQueries({
        queryKey: ["invites", workspaceId],
      });
    },
    onError: (err: ApiError) => toast.error("Could not invite", err.message),
  });

  if (!workspaceId) {
    return (
      <EmptyState
        icon={MailPlus}
        title="No workspace selected"
        hint="Create or join a workspace first."
      />
    );
  }

  const canInvite = role === "owner" || role === "admin" || role === "manager";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim()) invite.mutate();
  };

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 py-6">
      <PageHeader
        title="Invitations"
        subtitle={`${workspace?.name} · seats are limited by the workspace plan`}
      />

      {canInvite ? (
        <Card className="mb-5">
          <form
            onSubmit={submit}
            className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px_auto]"
          >
            <Field label="Email address">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@company.com"
                required
              />
            </Field>
            <Field label="Role">
              <Select
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(event.target.value as Exclude<Role, "owner">)
                }
              >
                {(["admin", "manager", "member", "viewer"] as const).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button
                type="submit"
                variant="primary"
                icon={MailPlus}
                loading={invite.isPending}
                disabled={!email.trim()}
              >
                Send invite
              </Button>
            </div>
          </form>
          {issuedToken ? (
            <div className="mt-4 rounded-lg border border-info/30 bg-info-soft px-3.5 py-2.5 text-[12px] text-info">
              Mail delivery is not configured — share this accept link manually:{" "}
              <code className="break-all font-mono text-[11px]">
                {`${window.location.origin}/invites/${issuedToken}`}
              </code>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[10.5px] font-bold uppercase tracking-wider text-faint">
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">State</th>
                <th className="px-4 py-2.5">Invited</th>
                <th className="px-4 py-2.5">Expires</th>
              </tr>
            </thead>
            <tbody>
              {(invitesQuery.data?.invites ?? []).map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-line/60 last:border-0 hover:bg-sunken/40"
                >
                  <td className="px-4 py-3 text-[12.5px] font-semibold text-ink">
                    {item.email}
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{item.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        item.state === "pending"
                          ? "brand"
                          : item.state === "accepted"
                            ? "success"
                            : "default"
                      }
                    >
                      {item.state}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-faint">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-faint">
                    {new Date(item.expiresAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {invitesQuery.data && invitesQuery.data.invites.length === 0 ? (
          <EmptyState
            icon={MailPlus}
            title="No invitations yet"
            hint="Invite a teammate to get started."
          />
        ) : null}
      </Card>

      <Card className="mt-5">
        <h2 className="mb-1 text-[13.5px] font-bold text-ink">
          Already invited somewhere?
        </h2>
        <p className="mb-3 text-[12.5px] text-muted">
          Paste an invite token to accept or decline it.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/accept-invite">
            <Button>Open the accept screen</Button>
          </Link>
          <Button
            variant="ghost"
            icon={RefreshCw}
            onClick={() => void refreshWorkspaces()}
          >
            Refresh my workspaces
          </Button>
        </div>
      </Card>
    </div>
  );
}

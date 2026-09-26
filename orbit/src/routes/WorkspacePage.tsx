import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2, ShieldAlert, Trash2 } from "lucide-react";
import { ApiError } from "../api/client";
import { workspacesApi } from "../api/endpoints";
import type { WorkspaceDetail } from "../api/types";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CenterState,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
} from "../components/ui";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

export function WorkspacePage() {
  const { workspaceId, role, user, refreshWorkspaces, selectWorkspace } =
    useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const detailQuery = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspacesApi.get(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const membersQuery = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => workspacesApi.members(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const transfer = useMutation({
    mutationFn: ({
      toUserId,
      confirm,
    }: {
      toUserId: string;
      confirm: string;
    }) =>
      workspacesApi.transferOwnership(workspaceId as string, toUserId, confirm),
    onSuccess: () => {
      toast.success("Ownership transferred");
      setTransferOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ["members", workspaceId],
      });
      void refreshWorkspaces();
      if (workspaceId) void selectWorkspace(workspaceId);
    },
    onError: (err: ApiError) => toast.error("Transfer failed", err.message),
  });

  const remove = useMutation({
    mutationFn: (confirm: string) =>
      workspacesApi.remove(workspaceId as string, confirm),
    onSuccess: async () => {
      toast.success("Workspace deleted");
      setDeleteOpen(false);
      await refreshWorkspaces();
      navigate("/", { replace: true });
    },
    onError: (err: ApiError) => toast.error("Delete failed", err.message),
  });

  const leave = useMutation({
    mutationFn: () => workspacesApi.leave(workspaceId as string),
    onSuccess: async () => {
      toast.success("You left the workspace");
      setLeaveOpen(false);
      await refreshWorkspaces();
      navigate("/", { replace: true });
    },
    onError: (err: ApiError) => toast.error("Could not leave", err.message),
  });

  if (!workspaceId) {
    return (
      <EmptyState
        icon={Settings2}
        title="No workspace selected"
        hint="Create or join a workspace first."
      />
    );
  }
  if (detailQuery.isLoading)
    return <CenterState>Loading workspace…</CenterState>;
  const detail: WorkspaceDetail | undefined = detailQuery.data;
  if (!detail) {
    return (
      <div className="mx-auto max-w-lg px-5 py-10">
        <ErrorBox
          message={
            (detailQuery.error as ApiError)?.message ??
            "Could not load this workspace"
          }
        />
      </div>
    );
  }

  const isOwner = role === "owner";
  const isAdmin = role === "admin" || isOwner;
  const members = membersQuery.data?.members ?? [];
  const transferTargets = members.filter(
    (member) => member.userId !== user?.id && member.role !== "owner",
  );

  return (
    <div className="mx-auto w-full max-w-[1000px] px-5 py-6">
      <PageHeader
        title="Workspace settings"
        subtitle={`${detail.name} · ${detail.plan} plan · ${detail.stats.memberCount}/${detail.seatLimit} seats used`}
        actions={<Badge tone="brand">{role}</Badge>}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <GeneralSettingsForm
          key={JSON.stringify([detail.name, detail.slug, detail.settings])}
          workspaceId={workspaceId}
          detail={detail}
          canEdit={isAdmin}
        />

        <Card>
          <CardHeader title="Stats" />
          <div className="space-y-2">
            <Stat
              label="Members"
              value={`${detail.stats.memberCount} of ${detail.seatLimit}`}
            />
            <Stat label="Boards" value={detail.stats.boardCount} />
            <Stat label="Plan" value={detail.plan} />
            <Stat
              label="Created"
              value={new Date(detail.createdAt).toLocaleDateString()}
            />
          </div>

          {isOwner ? (
            <>
              <h3 className="mb-1.5 mt-6 text-[13px] font-bold text-ink">
                Ownership
              </h3>
              <p className="mb-3 text-[12px] leading-relaxed text-muted">
                Transfer makes another member the owner and demotes you to
                admin. This cannot be undone without the new owner transferring
                it back.
              </p>
              <Button
                icon={ShieldAlert}
                disabled={transferTargets.length === 0}
                onClick={() => setTransferOpen(true)}
              >
                Transfer ownership
              </Button>
              {transferTargets.length === 0 ? (
                <p className="mt-2 text-[11.5px] text-faint">
                  Invite another member before transferring ownership.
                </p>
              ) : null}
            </>
          ) : null}
        </Card>
      </div>

      <Card className="mt-5 border-danger/40">
        <h2 className="mb-2 flex items-center gap-2 text-[13.5px] font-bold text-danger">
          <ShieldAlert size={14} aria-hidden /> Danger zone
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {!isOwner ? (
            <Button onClick={() => setLeaveOpen(true)}>
              Leave this workspace
            </Button>
          ) : (
            <span className="text-[12.5px] text-faint">
              Owners cannot leave — transfer ownership first.
            </span>
          )}
          {isOwner ? (
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => setDeleteOpen(true)}
            >
              Delete workspace
            </Button>
          ) : null}
        </div>
      </Card>

      {transferOpen ? (
        <TransferDialog
          slug={detail.slug}
          targets={transferTargets.map((member) => ({
            userId: member.userId,
            name: member.name,
          }))}
          busy={transfer.isPending}
          onConfirm={(toUserId, confirm) =>
            transfer.mutate({ toUserId, confirm })
          }
          onClose={() => setTransferOpen(false)}
        />
      ) : null}

      {deleteOpen ? (
        <ConfirmDialog
          title="Delete this workspace?"
          body="Every board, list and card in this workspace becomes inaccessible. This is a soft delete, but there is no undo in the UI."
          confirmLabel="Delete workspace"
          danger
          requireText={detail.slug}
          busy={remove.isPending}
          onConfirm={(typed) => remove.mutate(typed)}
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}

      {leaveOpen ? (
        <ConfirmDialog
          title="Leave this workspace?"
          body="You lose access immediately and are unassigned from every card here."
          confirmLabel="Leave workspace"
          danger
          busy={leave.isPending}
          onConfirm={() => leave.mutate()}
          onClose={() => setLeaveOpen(false)}
        />
      ) : null}
    </div>
  );
}

function GeneralSettingsForm({
  workspaceId,
  detail,
  canEdit,
}: {
  workspaceId: string;
  detail: WorkspaceDetail;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { refreshWorkspaces } = useAuth();

  const [name, setName] = useState(detail.name);
  const [slug, setSlug] = useState(detail.slug);
  const [timezone, setTimezone] = useState(detail.settings.timezone);
  const [weekStart, setWeekStart] = useState<0 | 1>(detail.settings.weekStart);
  const [defaultRole, setDefaultRole] = useState<"member" | "viewer">(
    detail.settings.defaultRole,
  );

  const save = useMutation({
    mutationFn: () =>
      workspacesApi.update(workspaceId, {
        name,
        slug,
        settings: { timezone, weekStart, defaultRole },
      }),
    onSuccess: () => {
      toast.success("Workspace updated");
      void queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceId],
      });
      void refreshWorkspaces();
    },
    onError: (err: ApiError) =>
      toast.error("Could not update workspace", err.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <Card>
      <CardHeader title="General" />
      {save.isError ? (
        <ErrorBox message={(save.error as ApiError).message} />
      ) : null}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Workspace name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            disabled={!canEdit}
          />
        </Field>
        <Field
          label="Slug"
          hint="Used in URLs. Changing it does not break existing data."
        >
          <Input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            pattern="[a-z0-9-]+"
            minLength={3}
            maxLength={48}
            disabled={!canEdit}
            className="font-mono"
          />
        </Field>
        <Field label="Timezone">
          <Input
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            maxLength={64}
            disabled={!canEdit}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Week starts on">
            <Select
              value={weekStart}
              onChange={(event) =>
                setWeekStart(Number(event.target.value) as 0 | 1)
              }
              disabled={!canEdit}
            >
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </Select>
          </Field>
          <Field label="Default role">
            <Select
              value={defaultRole}
              onChange={(event) =>
                setDefaultRole(event.target.value as "member" | "viewer")
              }
              disabled={!canEdit}
            >
              <option value="member">member</option>
              <option value="viewer">viewer</option>
            </Select>
          </Field>
        </div>
        <Button
          type="submit"
          variant="primary"
          loading={save.isPending}
          disabled={!canEdit}
        >
          Save changes
        </Button>
        {!canEdit ? (
          <p className="text-[11.5px] text-faint">
            Only owners and admins can edit these.
          </p>
        ) : null}
      </form>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-sunken/70 px-3 py-2">
      <span className="text-[12px] text-muted">{label}</span>
      <strong className="text-[12.5px] capitalize text-ink">{value}</strong>
    </div>
  );
}

function TransferDialog({
  slug,
  targets,
  busy,
  onConfirm,
  onClose,
}: {
  slug: string;
  targets: { userId: string; name: string }[];
  busy: boolean;
  onConfirm: (toUserId: string, confirm: string) => void;
  onClose: () => void;
}) {
  const [toUserId, setToUserId] = useState(targets[0]?.userId ?? "");
  const [confirm, setConfirm] = useState("");

  return (
    <Modal
      title="Transfer ownership"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy || confirm !== slug || !toUserId}
            loading={busy}
            onClick={() => onConfirm(toUserId, confirm)}
          >
            Transfer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="New owner">
          <Select
            value={toUserId}
            onChange={(event) => setToUserId(event.target.value)}
          >
            {targets.map((target) => (
              <option key={target.userId} value={target.userId}>
                {target.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type the workspace slug to confirm" hint={slug}>
          <Input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoFocus
            className="font-mono"
          />
        </Field>
      </div>
    </Modal>
  );
}

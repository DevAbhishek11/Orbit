import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { workspacesApi } from "../api/endpoints";
import type { WorkspaceDetail } from "../api/types";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";
import {
  Badge,
  CenterState,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Field,
  Modal,
  Spinner,
} from "../components/ui";

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
      <div className="page">
        <EmptyState
          icon="⚙"
          title="No workspace selected"
          hint="Create or join a workspace first."
        />
      </div>
    );
  }
  if (detailQuery.isLoading)
    return <CenterState>Loading workspace…</CenterState>;
  const detail: WorkspaceDetail | undefined = detailQuery.data;
  if (!detail) {
    return (
      <div className="page">
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
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h1>Workspace settings</h1>
          <p className="page__subtitle">
            {detail.name} · {detail.plan} plan · {detail.stats.memberCount}/
            {detail.seatLimit} seats used
          </p>
        </div>
        <Badge tone="accent">{role}</Badge>
      </div>

      <div className="grid grid--two">
        {}
        <GeneralSettingsForm
          key={JSON.stringify([detail.name, detail.slug, detail.settings])}
          workspaceId={workspaceId}
          detail={detail}
          canEdit={isAdmin}
        />

        <section className="panel">
          <h2 style={{ marginBottom: 16 }}>Stats</h2>
          <div className="stack" style={{ gap: 10 }}>
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
              <h2 style={{ margin: "24px 0 12px" }}>Ownership</h2>
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                Transfer makes another member the owner and demotes you to
                admin. This cannot be undone without the new owner transferring
                it back.
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => setTransferOpen(true)}
                disabled={transferTargets.length === 0}
              >
                Transfer ownership
              </button>
              {transferTargets.length === 0 ? (
                <p className="field__hint" style={{ marginTop: 8 }}>
                  Invite another member before transferring ownership.
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      </div>

      <section
        className="panel"
        style={{ marginTop: 20, borderColor: "var(--danger)" }}
      >
        <h2 style={{ color: "var(--danger)", marginBottom: 8 }}>Danger zone</h2>
        <div className="row row--wrap" style={{ gap: 12 }}>
          {!isOwner ? (
            <button
              type="button"
              className="btn"
              onClick={() => setLeaveOpen(true)}
            >
              Leave this workspace
            </button>
          ) : (
            <span className="faint" style={{ fontSize: 13 }}>
              Owners cannot leave — transfer ownership first.
            </span>
          )}
          {isOwner ? (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setDeleteOpen(true)}
            >
              Delete workspace
            </button>
          ) : null}
        </div>
      </section>

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
    <section className="panel">
      <h2 style={{ marginBottom: 16 }}>General</h2>
      {save.isError ? (
        <ErrorBox message={(save.error as ApiError).message} />
      ) : null}
      <form onSubmit={submit}>
        <Field label="Workspace name">
          <input
            className="input"
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
          <input
            className="input mono"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            pattern="[a-z0-9-]+"
            minLength={3}
            maxLength={48}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Timezone">
          <input
            className="input"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            maxLength={64}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Week starts on">
          <select
            className="select"
            value={weekStart}
            onChange={(event) =>
              setWeekStart(Number(event.target.value) as 0 | 1)
            }
            disabled={!canEdit}
          >
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
          </select>
        </Field>
        <Field label="Default role for new members">
          <select
            className="select"
            value={defaultRole}
            onChange={(event) =>
              setDefaultRole(event.target.value as "member" | "viewer")
            }
            disabled={!canEdit}
          >
            <option value="member">member</option>
            <option value="viewer">viewer</option>
          </select>
        </Field>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={save.isPending || !canEdit}
        >
          {save.isPending ? <Spinner /> : null}
          Save changes
        </button>
        {!canEdit ? (
          <p className="field__hint" style={{ marginTop: 10 }}>
            Only owners and admins can edit these.
          </p>
        ) : null}
      </form>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="row row--between"
      style={{
        padding: "8px 12px",
        background: "var(--surface)",
        borderRadius: 8,
      }}
    >
      <span className="muted" style={{ fontSize: 13 }}>
        {label}
      </span>
      <strong style={{ textTransform: "capitalize" }}>{value}</strong>
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
      wide={false}
      footer={
        <>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy || confirm !== slug || !toUserId}
            onClick={() => onConfirm(toUserId, confirm)}
          >
            {busy ? <Spinner /> : null}
            Transfer
          </button>
        </>
      }
    >
      <Field label="New owner">
        <select
          className="select"
          value={toUserId}
          onChange={(event) => setToUserId(event.target.value)}
        >
          {targets.map((target) => (
            <option key={target.userId} value={target.userId}>
              {target.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Type the workspace slug to confirm" hint={slug}>
        <input
          className="input mono"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoFocus
        />
      </Field>
    </Modal>
  );
}

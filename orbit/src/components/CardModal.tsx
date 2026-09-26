import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Plus, X } from "lucide-react";
import { ApiError } from "../api/client";
import { cardsApi, workspacesApi } from "../api/endpoints";
import type { Card, Checklist } from "../api/types";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";
import {
  Avatar,
  Badge,
  Button,
  CenterState,
  ConfirmDialog,
  ErrorBox,
  Field,
  Input,
  Modal,
  ProgressBar,
  Select,
  Textarea,
} from "./ui";

const LABEL_COLORS = [
  "#f26b1d",
  "#a06bff",
  "#3ecf8e",
  "#f5a524",
  "#ff6b6b",
  "#38bdf8",
  "#f472b6",
];

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
      {children}
    </div>
  );
}

export function CardModal({
  cardId,
  boardId,
  onClose,
  readOnly,
}: {
  cardId: string;
  boardId: string;
  onClose: () => void;
  readOnly: boolean;
}) {
  const { workspaceId, user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const cardQuery = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => cardsApi.get(cardId),
  });
  const commentsQuery = useQuery({
    queryKey: ["card-comments", cardId],
    queryFn: () => cardsApi.comments(cardId),
  });
  const activityQuery = useQuery({
    queryKey: ["card-activity", cardId],
    queryFn: () => cardsApi.activity(cardId, 25),
  });
  const membersQuery = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => workspacesApi.members(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const [commentBody, setCommentBody] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [labelDraft, setLabelDraft] = useState<{
    name: string;
    color: string;
  } | null>(null);

  const card = cardQuery.data;
  const members = useMemo(
    () => membersQuery.data?.members ?? [],
    [membersQuery.data],
  );

  const patch = useMutation({
    mutationFn: (body: Parameters<typeof cardsApi.update>[2]) =>
      cardsApi.update(cardId, (card as Card).version, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(["card", cardId], updated);
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
    onError: (err: ApiError) => {
      if (err.code === "VERSION_CONFLICT") {
        toast.error(
          "This card changed elsewhere",
          "Reloading the latest version.",
        );
        void queryClient.invalidateQueries({ queryKey: ["card", cardId] });
        return;
      }
      toast.error("Update failed", err.message);
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => cardsApi.addComment(cardId, commentBody),
    onSuccess: () => {
      setCommentBody("");
      void queryClient.invalidateQueries({
        queryKey: ["card-comments", cardId],
      });
      void queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      void queryClient.invalidateQueries({
        queryKey: ["card-activity", cardId],
      });
    },
    onError: (err: ApiError) =>
      toast.error("Could not post comment", err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => cardsApi.remove(cardId),
    onSuccess: () => {
      toast.success("Card archived");
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      onClose();
    },
    onError: (err: ApiError) =>
      toast.error("Could not archive card", err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: () => cardsApi.restore(cardId),
    onSuccess: () => {
      toast.success("Card restored");
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      void queryClient.invalidateQueries({ queryKey: ["card", cardId] });
    },
    onError: (err: ApiError) =>
      toast.error("Could not restore card", err.message),
  });

  if (cardQuery.isLoading) {
    return (
      <Modal title="Card" onClose={onClose} size="sm">
        <CenterState>Loading card…</CenterState>
      </Modal>
    );
  }

  if (cardQuery.isError || !card) {
    return (
      <Modal title="Card" onClose={onClose} size="sm">
        <ErrorBox
          message={
            (cardQuery.error as ApiError)?.message ?? "Could not load this card"
          }
          requestId={(cardQuery.error as ApiError)?.requestId}
        />
      </Modal>
    );
  }

  const commitTitle = (value: string) => {
    const next = value.trim();
    if (!next || next === card.title) return;
    patch.mutate({ title: next });
  };

  const commitDescription = (value: string) => {
    if (value === (card.description ?? "")) return;
    patch.mutate({ description: value || null });
  };

  const toggleChecklistItem = (checklistId: string, itemId: string) => {
    const checklists = (card.checklists ?? []).map((checklist) =>
      checklist.id === checklistId
        ? {
            ...checklist,
            items: (checklist.items ?? []).map((item) =>
              item.id === itemId ? { ...item, done: !item.done } : item,
            ),
          }
        : checklist,
    );
    patch.mutate({ checklists });
  };

  const addChecklist = (title: string) => {
    const checklists: Checklist[] = [
      ...(card.checklists ?? []),
      { id: newId(), title, items: [] },
    ];
    patch.mutate({ checklists });
  };

  const removeChecklist = (checklistId: string) => {
    patch.mutate({
      checklists: (card.checklists ?? []).filter(
        (checklist) => checklist.id !== checklistId,
      ),
    });
  };

  const addChecklistItem = (checklistId: string, title: string) => {
    const checklists = (card.checklists ?? []).map((checklist) =>
      checklist.id === checklistId
        ? {
            ...checklist,
            items: [
              ...(checklist.items ?? []),
              { id: newId(), title, done: false },
            ],
          }
        : checklist,
    );
    patch.mutate({ checklists });
  };

  const toggleAssignee = (userId: string) => {
    const current = card.assignees ?? [];
    const assignees = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    patch.mutate({ assignees });
  };

  const totalItems = card.checklistProgress?.total ?? 0;
  const doneItems = card.checklistProgress?.done ?? 0;
  const progress =
    totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <>
      <Modal
        title={
          <span className="flex items-center gap-2">
            Card
            <Badge tone="brand">v{card.version}</Badge>
            {card.archivedAt ? <Badge tone="warning">archived</Badge> : null}
            {card.completedAt ? <Badge tone="success">completed</Badge> : null}
          </span>
        }
        onClose={onClose}
        size="lg"
        footer={
          <>
            {!readOnly && card.archivedAt ? (
              <Button
                icon={ArchiveRestore}
                loading={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate()}
              >
                Restore card
              </Button>
            ) : null}
            {!readOnly && !card.archivedAt ? (
              <Button
                variant="danger"
                icon={Archive}
                onClick={() => setConfirmDelete(true)}
              >
                Archive
              </Button>
            ) : null}
            <span className="flex-1" />
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
          <div className="min-w-0 space-y-6">
            <Field label="Title">
              <Input
                key={`title-${card.version}`}
                defaultValue={card.title}
                onBlur={(event) => commitTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter")
                    commitTitle(event.currentTarget.value);
                }}
                disabled={readOnly || patch.isPending}
                maxLength={200}
              />
            </Field>

            <Field label="Description">
              <Textarea
                key={`description-${card.version}`}
                defaultValue={card.description ?? ""}
                onBlur={(event) => commitDescription(event.target.value)}
                placeholder="Add a description…"
                disabled={readOnly || patch.isPending}
                maxLength={20000}
              />
            </Field>

            <div>
              <SectionTitle>Labels</SectionTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                {(card.labels ?? []).map((label) => (
                  <span key={label.id} className="flex items-center gap-1">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10.5px] font-bold text-white"
                      style={{ background: label.color }}
                    >
                      {label.name}
                    </span>
                    {!readOnly ? (
                      <button
                        type="button"
                        aria-label={`Remove ${label.name}`}
                        className="cursor-pointer rounded p-0.5 text-faint hover:text-danger"
                        onClick={() =>
                          patch.mutate({
                            labels: (card.labels ?? []).filter(
                              (item) => item.id !== label.id,
                            ),
                          })
                        }
                      >
                        <X size={12} />
                      </button>
                    ) : null}
                  </span>
                ))}
                {!readOnly && (card.labels ?? []).length < 6 ? (
                  labelDraft ? (
                    <span className="flex items-center gap-1.5">
                      <Input
                        value={labelDraft.name}
                        onChange={(event) =>
                          setLabelDraft({
                            ...labelDraft,
                            name: event.target.value,
                          })
                        }
                        placeholder="Label"
                        autoFocus
                        maxLength={40}
                        className="h-7 w-[110px] text-[12px]"
                      />
                      <Button
                        variant="primary"
                        size="xs"
                        disabled={!labelDraft.name.trim()}
                        onClick={() => {
                          patch.mutate({
                            labels: [
                              ...(card.labels ?? []),
                              {
                                id: newId(),
                                name: labelDraft.name.trim(),
                                color: labelDraft.color,
                              },
                            ],
                          });
                          setLabelDraft(null);
                        }}
                      >
                        Add
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setLabelDraft(null)}
                      >
                        <X size={12} />
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="xs"
                      icon={Plus}
                      onClick={() =>
                        setLabelDraft({
                          name: "",
                          color:
                            LABEL_COLORS[
                              (card.labels ?? []).length % LABEL_COLORS.length
                            ]!,
                        })
                      }
                    >
                      Label
                    </Button>
                  )
                ) : null}
              </div>
            </div>

            <div>
              <SectionTitle>
                Checklists {totalItems > 0 ? `· ${progress}%` : ""}
              </SectionTitle>
              {totalItems > 0 ? (
                <div className="mb-3">
                  <ProgressBar
                    value={progress}
                    tone={progress === 100 ? "ok" : "brand"}
                  />
                </div>
              ) : null}
              <div className="space-y-4">
                {(card.checklists ?? []).map((checklist) => (
                  <div
                    key={checklist.id}
                    className="rounded-lg border border-line p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <strong className="text-[12.5px] text-ink">
                        {checklist.title}
                      </strong>
                      {!readOnly ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => removeChecklist(checklist.id)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      {(checklist.items ?? []).map((item) => (
                        <label
                          key={item.id}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-[12.5px] hover:bg-sunken ${
                            item.done ? "text-faint line-through" : "text-ink"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.done}
                            disabled={readOnly || patch.isPending}
                            onChange={() =>
                              toggleChecklistItem(checklist.id, item.id)
                            }
                            className="h-3.5 w-3.5 cursor-pointer accent-[var(--brand)]"
                          />
                          {item.title}
                        </label>
                      ))}
                    </div>
                    {!readOnly ? (
                      <AddItemForm
                        onAdd={(title) => addChecklistItem(checklist.id, title)}
                        placeholder="Add an item"
                      />
                    ) : null}
                  </div>
                ))}
                {!readOnly ? (
                  <AddItemForm
                    onAdd={addChecklist}
                    placeholder="Add a checklist"
                  />
                ) : null}
              </div>
            </div>

            <div>
              <SectionTitle>
                Comments ({commentsQuery.data?.comments.length ?? 0})
              </SectionTitle>
              <div className="space-y-3">
                {commentsQuery.data?.comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2.5">
                    <Avatar
                      name={
                        members.find((m) => m.userId === comment.authorId)
                          ?.name ?? comment.authorId
                      }
                    />
                    <div className="min-w-0 flex-1 rounded-lg rounded-tl-none border border-line bg-sunken/50 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <strong className="text-[12px] text-ink">
                          {members.find((m) => m.userId === comment.authorId)
                            ?.name ?? "Unknown"}
                        </strong>
                        <span className="text-[10.5px] text-faint">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-[12.5px] text-ink">
                        {comment.body}
                      </div>
                    </div>
                  </div>
                ))}
                {commentsQuery.data &&
                commentsQuery.data.comments.length === 0 ? (
                  <p className="text-[12.5px] text-faint">
                    No comments yet. Use @handle to mention someone.
                  </p>
                ) : null}
              </div>
              {!readOnly ? (
                <form
                  className="mt-3"
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    if (commentBody.trim()) commentMutation.mutate();
                  }}
                >
                  <Textarea
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    placeholder={`Comment as ${user?.name ?? "you"}…`}
                    maxLength={4000}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="mt-2"
                    loading={commentMutation.isPending}
                    disabled={!commentBody.trim()}
                  >
                    Comment
                  </Button>
                </form>
              ) : null}
            </div>

            <div>
              <SectionTitle>Activity</SectionTitle>
              <div className="space-y-3 border-l-2 border-line pl-4">
                {activityQuery.data?.activities.map((entry, index) => (
                  <div key={`${entry.createdAt}-${index}`} className="relative">
                    <span className="absolute -left-[21.5px] top-1.5 h-2 w-2 rounded-full bg-line-strong" />
                    <div className="text-[12.5px] text-ink">
                      <strong>
                        {members.find((m) => m.userId === entry.actorId)
                          ?.name ?? entry.actorId}
                      </strong>{" "}
                      <span className="text-muted">
                        {entry.action.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="text-[11px] text-faint">
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {activityQuery.data &&
                activityQuery.data.activities.length === 0 ? (
                  <p className="text-[12.5px] text-faint">
                    No activity recorded yet.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div>
              <SectionTitle>Status</SectionTitle>
              <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px] font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={Boolean(card.completedAt)}
                  disabled={readOnly || patch.isPending}
                  onChange={(event) =>
                    patch.mutate({ completed: event.target.checked })
                  }
                  className="h-4 w-4 cursor-pointer accent-[var(--brand)]"
                />
                Completed
              </label>
            </div>

            <Field label="Due date">
              <Input
                type="datetime-local"
                value={toDateInput(card.dueAt)}
                disabled={readOnly || patch.isPending}
                onChange={(event) =>
                  patch.mutate({
                    dueAt: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : null,
                  })
                }
              />
            </Field>

            <Field label="Priority">
              <Select
                value={card.priority}
                disabled={readOnly || patch.isPending}
                onChange={(event) =>
                  patch.mutate({
                    priority: event.target.value as Card["priority"],
                  })
                }
              >
                {["none", "low", "medium", "high", "urgent"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>

            <div>
              <SectionTitle>Assignees</SectionTitle>
              <div className="max-h-[220px] space-y-1 overflow-y-auto">
                {members.map((member) => (
                  <label
                    key={member.userId}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-[12.5px] text-ink hover:bg-sunken"
                  >
                    <input
                      type="checkbox"
                      checked={(card.assignees ?? []).includes(member.userId)}
                      disabled={readOnly || patch.isPending}
                      onChange={() => toggleAssignee(member.userId)}
                      className="h-3.5 w-3.5 cursor-pointer accent-[var(--brand)]"
                    />
                    <Avatar
                      name={member.name}
                      url={member.avatarUrl}
                      size="sm"
                    />
                    <span className="truncate">{member.name}</span>
                  </label>
                ))}
                {members.length === 0 ? (
                  <span className="text-[12px] text-faint">
                    No members found.
                  </span>
                ) : null}
              </div>
            </div>

            <div className="text-[11px] leading-relaxed text-faint">
              Created {new Date(card.createdAt).toLocaleDateString()}
              <br />
              Updated {new Date(card.updatedAt).toLocaleString()}
            </div>
          </aside>
        </div>
      </Modal>

      {confirmDelete ? (
        <ConfirmDialog
          title="Archive this card?"
          body="The card leaves the board and its list counters are decremented. It can be restored later."
          confirmLabel="Archive card"
          danger
          busy={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </>
  );
}

function AddItemForm({
  onAdd,
  placeholder,
}: {
  onAdd: (title: string) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="mt-2 flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        onAdd(value.trim());
        setValue("");
      }}
    >
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        maxLength={200}
        className="h-8 text-[12px]"
      />
      <Button type="submit" size="sm" disabled={!value.trim()}>
        Add
      </Button>
    </form>
  );
}

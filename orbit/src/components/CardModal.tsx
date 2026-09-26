import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { cardsApi, workspacesApi } from "../api/endpoints";
import type { Card, Checklist } from "../api/types";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";
import {
  Avatar,
  Badge,
  ConfirmDialog,
  ErrorBox,
  Field,
  Modal,
  Spinner,
} from "./ui";

const LABEL_COLORS = [
  "#6c8cff",
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
      <Modal title="Card" onClose={onClose} wide={false}>
        <div className="center-state" style={{ height: 160 }}>
          <Spinner large />
        </div>
      </Modal>
    );
  }

  if (cardQuery.isError || !card) {
    return (
      <Modal title="Card" onClose={onClose} wide={false}>
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
    const currentAssignees = card.assignees ?? [];
    const assignees = currentAssignees.includes(userId)
      ? currentAssignees.filter((id) => id !== userId)
      : [...currentAssignees, userId];
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
          <div className="row" style={{ gap: 8 }}>
            <span>Card</span>
            <Badge tone="accent">v{card.version}</Badge>
            {card.archivedAt ? <Badge tone="warning">archived</Badge> : null}
            {card.completedAt ? <Badge tone="success">completed</Badge> : null}
          </div>
        }
        onClose={onClose}
        footer={
          <>
            {!readOnly && card.archivedAt ? (
              <button
                type="button"
                className="btn"
                disabled={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate()}
              >
                {restoreMutation.isPending ? <Spinner /> : null}
                Restore card
              </button>
            ) : null}
            {!readOnly && !card.archivedAt ? (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => setConfirmDelete(true)}
              >
                Archive
              </button>
            ) : null}
            <span className="grow" />
            <button
              type="button"
              className="btn btn--primary"
              onClick={onClose}
            >
              Done
            </button>
          </>
        }
      >
        <div className="detail-grid">
          <div>
            <Field label="Title">
              <input
                key={`title-${card.version}`}
                className="input"
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
              <textarea
                key={`description-${card.version}`}
                className="textarea"
                defaultValue={card.description ?? ""}
                onBlur={(event) => commitDescription(event.target.value)}
                placeholder="Add a description…"
                disabled={readOnly || patch.isPending}
                maxLength={20000}
              />
            </Field>

            <div className="detail-section">
              <div className="detail-section__title">Labels</div>
              <div className="row row--wrap">
                {(card.labels ?? []).map((label) => (
                  <span key={label.id} className="row" style={{ gap: 4 }}>
                    <span
                      className="label-chip"
                      style={{ background: label.color }}
                    >
                      {label.name}
                    </span>
                    {!readOnly ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon"
                        style={{ width: 20, height: 20 }}
                        aria-label={`Remove ${label.name}`}
                        onClick={() =>
                          patch.mutate({
                            labels: (card.labels ?? []).filter(
                              (item) => item.id !== label.id,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
                {!readOnly && (card.labels ?? []).length < 6 ? (
                  labelDraft ? (
                    <span className="row" style={{ gap: 4 }}>
                      <input
                        className="input"
                        style={{ width: 110, padding: "3px 8px" }}
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
                      />
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
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
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => setLabelDraft(null)}
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--sm"
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
                      + Label
                    </button>
                  )
                ) : null}
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-section__title">
                Checklists {totalItems > 0 ? `· ${progress}%` : ""}
              </div>
              {totalItems > 0 ? (
                <div className="progress" style={{ marginBottom: 12 }}>
                  <div
                    className="progress__bar"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              ) : null}
              {(card.checklists ?? []).map((checklist) => (
                <div key={checklist.id} style={{ marginBottom: 14 }}>
                  <div className="row row--between">
                    <strong style={{ fontSize: 13 }}>{checklist.title}</strong>
                    {!readOnly ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => removeChecklist(checklist.id)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {(checklist.items ?? []).map((item) => (
                    <label
                      key={item.id}
                      className={`checklist__item${item.done ? " checklist__item--done" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        disabled={readOnly || patch.isPending}
                        onChange={() =>
                          toggleChecklistItem(checklist.id, item.id)
                        }
                      />
                      <span>{item.title}</span>
                    </label>
                  ))}
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

            <div className="detail-section">
              <div className="detail-section__title">
                Comments ({commentsQuery.data?.comments.length ?? 0})
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {commentsQuery.data?.comments.map((comment) => (
                  <div key={comment.id} className="comment">
                    <Avatar
                      name={
                        members.find((m) => m.userId === comment.authorId)
                          ?.name ?? comment.authorId
                      }
                    />
                    <div className="comment__body">
                      <div className="comment__head">
                        <strong>
                          {members.find((m) => m.userId === comment.authorId)
                            ?.name ?? "Unknown"}
                        </strong>
                        <span>
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ whiteSpace: "pre-wrap" }}>
                        {comment.body}
                      </div>
                    </div>
                  </div>
                ))}
                {commentsQuery.data &&
                commentsQuery.data.comments.length === 0 ? (
                  <p className="faint" style={{ margin: 0, fontSize: 13 }}>
                    No comments yet. Use @handle to mention someone.
                  </p>
                ) : null}
              </div>
              {!readOnly ? (
                <form
                  style={{ marginTop: 12 }}
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    if (commentBody.trim()) commentMutation.mutate();
                  }}
                >
                  <textarea
                    className="textarea"
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    placeholder={`Comment as ${user?.name ?? "you"}…`}
                    maxLength={4000}
                  />
                  <button
                    type="submit"
                    className="btn btn--primary btn--sm"
                    style={{ marginTop: 8 }}
                    disabled={commentMutation.isPending || !commentBody.trim()}
                  >
                    {commentMutation.isPending ? <Spinner /> : null}
                    Comment
                  </button>
                </form>
              ) : null}
            </div>

            <div className="detail-section">
              <div className="detail-section__title">Activity</div>
              <div className="timeline">
                {activityQuery.data?.activities.map((entry, index) => (
                  <div
                    key={`${entry.createdAt}-${index}`}
                    className="timeline__item"
                  >
                    <span className="timeline__dot" />
                    <div>
                      <div>
                        <strong>
                          {members.find((m) => m.userId === entry.actorId)
                            ?.name ?? entry.actorId}
                        </strong>{" "}
                        <span className="muted">
                          {entry.action.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="faint" style={{ fontSize: 12 }}>
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
                {activityQuery.data &&
                activityQuery.data.activities.length === 0 ? (
                  <p className="faint" style={{ margin: 0, fontSize: 13 }}>
                    No activity recorded yet.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="stack">
            <div>
              <div className="detail-section__title">Status</div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(card.completedAt)}
                  disabled={readOnly || patch.isPending}
                  onChange={(event) =>
                    patch.mutate({ completed: event.target.checked })
                  }
                />
                Completed
              </label>
            </div>

            <div>
              <div className="detail-section__title">Due date</div>
              <input
                className="input"
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
            </div>

            <div>
              <div className="detail-section__title">Priority</div>
              <select
                className="select"
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
              </select>
            </div>

            <div>
              <div className="detail-section__title">Assignees</div>
              <div
                className="stack"
                style={{ gap: 4, maxHeight: 220, overflowY: "auto" }}
              >
                {members.map((member) => (
                  <label key={member.userId} className="checkbox">
                    <input
                      type="checkbox"
                      checked={(card.assignees ?? []).includes(member.userId)}
                      disabled={readOnly || patch.isPending}
                      onChange={() => toggleAssignee(member.userId)}
                    />
                    <Avatar name={member.name} url={member.avatarUrl} />
                    <span>{member.name}</span>
                  </label>
                ))}
                {members.length === 0 ? (
                  <span className="faint" style={{ fontSize: 12.5 }}>
                    No members found.
                  </span>
                ) : null}
              </div>
            </div>

            <div className="faint" style={{ fontSize: 11.5 }}>
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
      className="row"
      style={{ marginTop: 6 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        onAdd(value.trim());
        setValue("");
      }}
    >
      <input
        className="input"
        style={{ padding: "5px 9px" }}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        maxLength={200}
      />
      <button type="submit" className="btn btn--sm" disabled={!value.trim()}>
        Add
      </button>
    </form>
  );
}

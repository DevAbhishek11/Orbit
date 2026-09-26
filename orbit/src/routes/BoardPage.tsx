import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  GripVertical,
  MessageSquare,
  Paperclip,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { ApiError } from "../api/client";
import { boardsApi, cardsApi } from "../api/endpoints";
import type { BoardView, Card } from "../api/types";
import { CardModal } from "../components/CardModal";
import { ErrorBoundary } from "../components/ErrorBoundary";
import {
  Avatar,
  Badge,
  Button,
  CenterState,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  Textarea,
} from "../components/ui";
import { useAuth } from "../state/auth";
import { useSocket } from "../state/socket";
import { useToast } from "../state/toast";

interface DragCard {
  cardId: string;
  fromListId: string;
}

interface DropTarget {
  listId: string;
  index: number;
}

const PRIORITY_TONE = {
  urgent: "danger",
  high: "warning",
  medium: "info",
  low: "default",
} as const;

export function BoardPage() {
  const { boardId = "" } = useParams();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const [dragCard, setDragCard] = useState<DragCard | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [dragListId, setDragListId] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);

  const readOnly = role === "viewer";
  const { socket, joinRoom, leaveRoom } = useSocket();

  const boardQuery = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => boardsApi.view(boardId),
  });

  const view = boardQuery.data;

  useEffect(() => {
    if (!socket || !boardId) return;
    const room = `board:${boardId}`;
    void joinRoom(room).catch(() => undefined);

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    };

    socket.on("card:moved", refresh);
    socket.on("card:updated", refresh);
    socket.on("card:created", refresh);
    socket.on("card:deleted", refresh);
    socket.on("list:reordered", refresh);
    socket.on("list:rebalanced", refresh);

    return () => {
      socket.off("card:moved", refresh);
      socket.off("card:updated", refresh);
      socket.off("card:created", refresh);
      socket.off("card:deleted", refresh);
      socket.off("list:reordered", refresh);
      socket.off("list:rebalanced", refresh);
      void leaveRoom(room).catch(() => undefined);
    };
  }, [socket, boardId, joinRoom, leaveRoom, queryClient]);

  const applyLocalMove = (cardId: string, toListId: string, index: number) => {
    queryClient.setQueryData<BoardView>(["board", boardId], (current) => {
      if (!current) return current;
      let moving: Card | undefined;
      const lists = current.lists.map((list) => {
        const without = list.cards.filter((card) => card.id !== cardId);
        if (!moving) moving = list.cards.find((card) => card.id === cardId);
        return { ...list, cards: without };
      });
      if (!moving) return current;
      const movedCard: Card = moving;
      const next = lists.map((list) => {
        if (list.id !== toListId) return list;
        const cards = [...list.cards];
        cards.splice(Math.max(0, Math.min(index, cards.length)), 0, {
          ...movedCard,
          listId: toListId,
        });
        return { ...list, cards };
      });
      return {
        ...current,
        lists: next.map((list) => ({ ...list, cardCount: list.cards.length })),
      };
    });
  };

  const moveMutation = useMutation({
    mutationFn: ({
      cardId,
      version,
      targetListId,
      beforeCardId,
      afterCardId,
    }: {
      cardId: string;
      version: number;
      targetListId: string;
      beforeCardId: string | null;
      afterCardId: string | null;
    }) =>
      cardsApi.move(cardId, version, {
        targetListId,
        beforeCardId,
        afterCardId,
      }),
    onSuccess: (moved) => {
      queryClient.setQueryData<BoardView>(["board", boardId], (current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((list) => ({
            ...list,
            cards: list.cards.map((card) =>
              card.id === moved.id
                ? { ...card, ...moved, listId: moved.listId }
                : card,
            ),
            cardCount: list.cards.length,
          })),
        };
      });
    },
    onError: (err: ApiError) => {
      toast.error(
        err.code === "VERSION_CONFLICT"
          ? "Card changed elsewhere"
          : "Move failed",
        err.message,
      );
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    if (!dragCard || !dropTarget || !view) return;

    const source = view.lists.find((list) => list.id === dragCard.fromListId);
    const card = source?.cards.find((item) => item.id === dragCard.cardId);
    const target = view.lists.find((list) => list.id === dropTarget.listId);
    if (!card || !target) return;

    const siblings = target.cards.filter((item) => item.id !== dragCard.cardId);
    const index = Math.max(0, Math.min(dropTarget.index, siblings.length));
    const beforeCardId = index > 0 ? (siblings[index - 1]?.id ?? null) : null;
    const afterCardId =
      index < siblings.length ? (siblings[index]?.id ?? null) : null;

    const sameList = dragCard.fromListId === dropTarget.listId;
    const currentIndex =
      source?.cards.findIndex((item) => item.id === dragCard.cardId) ?? -1;
    if (sameList && currentIndex === index) {
      setDragCard(null);
      setDropTarget(null);
      return;
    }

    applyLocalMove(dragCard.cardId, dropTarget.listId, index);
    moveMutation.mutate({
      cardId: dragCard.cardId,
      version: card.version,
      targetListId: dropTarget.listId,
      beforeCardId,
      afterCardId,
    });
    setDragCard(null);
    setDropTarget(null);
  };

  const reorderListsMutation = useMutation({
    mutationFn: (listIds: string[]) => boardsApi.reorderLists(boardId, listIds),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
    onError: (err: ApiError) => toast.error("Reorder failed", err.message),
  });

  const handleListDrop = (event: DragEvent, overListId: string) => {
    event.preventDefault();
    if (!dragListId || !view || dragListId === overListId) return;
    const ids = view.lists.map((list) => list.id);
    const from = ids.indexOf(dragListId);
    const to = ids.indexOf(overListId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    queryClient.setQueryData<BoardView>(["board", boardId], (current) => {
      if (!current) return current;
      const byId = new Map(current.lists.map((list) => [list.id, list]));
      return {
        ...current,
        lists: ids.map((id) => byId.get(id)!).filter(Boolean),
      };
    });
    reorderListsMutation.mutate(ids);
    setDragListId(null);
  };

  const addListMutation = useMutation({
    mutationFn: () => boardsApi.createList(boardId, { name: newListName }),
    onSuccess: () => {
      setNewListName("");
      setAddingList(false);
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
    onError: (err: ApiError) => toast.error("Could not add list", err.message),
  });

  const deleteListMutation = useMutation({
    mutationFn: ({ listId, force }: { listId: string; force: boolean }) =>
      boardsApi.removeList(listId, force),
    onSuccess: () => {
      setDeletingListId(null);
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      toast.success("List deleted");
    },
    onError: (err: ApiError) =>
      toast.error("Could not delete list", err.message),
  });

  const deletingList = useMemo(
    () => view?.lists.find((list) => list.id === deletingListId) ?? null,
    [view, deletingListId],
  );

  if (boardQuery.isLoading) return <CenterState>Loading board…</CenterState>;
  if (boardQuery.isError) {
    return (
      <div className="mx-auto max-w-lg px-5 py-10">
        <ErrorBox
          message={
            (boardQuery.error as ApiError)?.message ??
            "Could not load this board"
          }
          requestId={(boardQuery.error as ApiError)?.requestId}
        />
        <Button className="mt-4" icon={ArrowLeft} onClick={() => navigate("/")}>
          Back to boards
        </Button>
      </div>
    );
  }
  if (!view) return null;

  return (
    <>
      <div className="flex h-[calc(100dvh-56px)] flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-line bg-surface px-3 py-2.5 sm:px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate("/")}
            aria-label="Back"
          >
            <ArrowLeft size={15} />
          </Button>
          <strong className="text-[14px] text-ink">{view.board.name}</strong>
          {view.board.visibility === "private" ? (
            <Badge tone="warning">private</Badge>
          ) : null}
          <span className="text-[12px] text-faint">
            {view.board.stats.cardCount} cards · {view.lists.length} lists
          </span>
          <span className="flex-1" />
          {!readOnly ? (
            <Button
              size="sm"
              icon={Settings}
              onClick={() => setBoardMenuOpen(true)}
            >
              Board settings
            </Button>
          ) : null}
        </div>

        <div
          className="min-h-0 flex-1 overflow-auto bg-app p-3 sm:p-4"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex h-full items-start gap-3.5">
            {view.lists.map((list) => (
              <section
                key={list.id}
                className="flex max-h-full w-[85vw] max-w-[272px] shrink-0 flex-col rounded-xl border border-line bg-surface/80 shadow-sm sm:w-[272px]"
                onDragOver={(event) => {
                  if (!dragListId) return;
                  event.preventDefault();
                }}
                onDrop={(event) => handleListDrop(event, list.id)}
              >
                <header
                  draggable={!readOnly}
                  onDragStart={() => setDragListId(list.id)}
                  onDragEnd={() => setDragListId(null)}
                  className={`flex shrink-0 items-center gap-2 px-3 py-2.5 ${readOnly ? "" : "cursor-grab"}`}
                >
                  <GripVertical
                    size={13}
                    className="shrink-0 text-faint"
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => setRenamingListId(list.id)}
                    title="Rename list"
                    className="min-w-0 flex-1 cursor-pointer truncate text-left text-[12.5px] font-bold text-ink hover:text-brand"
                  >
                    {list.name}
                  </button>
                  <span className="rounded-full bg-sunken px-2 py-0.5 text-[10.5px] font-bold text-muted">
                    {list.cards.length}
                  </span>
                  {list.wipLimit && list.cards.length > list.wipLimit ? (
                    <Badge tone="danger">WIP</Badge>
                  ) : null}
                  {!readOnly ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${list.name}`}
                      onClick={() => setDeletingListId(list.id)}
                    >
                      <X size={13} />
                    </Button>
                  ) : null}
                </header>

                <div
                  className={`min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 pb-2 ${
                    dropTarget?.listId === list.id ? "bg-brand-soft/40" : ""
                  }`}
                  onDragOver={(event) => {
                    if (!dragCard) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropTarget({
                      listId: list.id,
                      index: list.cards.filter((c) => c.id !== dragCard.cardId)
                        .length,
                    });
                  }}
                >
                  {list.cards
                    .filter(
                      (card) =>
                        card.id !== dragCard?.cardId ||
                        dropTarget?.listId !== list.id,
                    )
                    .map((card) => {
                      const siblings = list.cards.filter(
                        (item) => item.id !== dragCard?.cardId,
                      );
                      const visualIndex = siblings.findIndex(
                        (item) => item.id === card.id,
                      );
                      return (
                        <div key={card.id}>
                          {dropTarget?.listId === list.id &&
                          dropTarget.index === visualIndex ? (
                            <div className="mb-2 h-0.5 rounded bg-brand" />
                          ) : null}
                          <article
                            draggable={!readOnly}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", card.id);
                              setDragCard({
                                cardId: card.id,
                                fromListId: list.id,
                              });
                            }}
                            onDragEnd={() => {
                              setDragCard(null);
                              setDropTarget(null);
                            }}
                            onDragOver={(event) => {
                              if (!dragCard || dragCard.cardId === card.id)
                                return;
                              event.preventDefault();
                              event.stopPropagation();
                              const rect =
                                event.currentTarget.getBoundingClientRect();
                              const after =
                                event.clientY - rect.top > rect.height / 2;
                              setDropTarget({
                                listId: list.id,
                                index: visualIndex + (after ? 1 : 0),
                              });
                            }}
                            onClick={() => setOpenCardId(card.id)}
                            className={`cursor-pointer rounded-lg border border-line bg-surface p-3 shadow-sm transition-all hover:-translate-y-px hover:border-brand/50 hover:shadow-md ${
                              dragCard?.cardId === card.id ? "opacity-40" : ""
                            } ${card.completedAt ? "opacity-70" : ""}`}
                          >
                            {card.labels.length > 0 ? (
                              <div className="mb-2 flex flex-wrap gap-1">
                                {card.labels.slice(0, 3).map((label) => (
                                  <span
                                    key={label.id}
                                    className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                                    style={{ background: label.color }}
                                  >
                                    {label.name}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div
                              className={`text-[12.5px] font-semibold leading-snug text-ink ${
                                card.completedAt ? "line-through" : ""
                              }`}
                            >
                              {card.title}
                            </div>
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              {card.priority !== "none" ? (
                                <Badge tone={PRIORITY_TONE[card.priority]}>
                                  {card.priority}
                                </Badge>
                              ) : null}
                              {card.dueAt ? (
                                <span className="flex items-center gap-1 text-[10.5px] font-semibold text-faint">
                                  <CalendarDays size={11} aria-hidden />
                                  {new Date(card.dueAt).toLocaleDateString()}
                                </span>
                              ) : null}
                              {card.checklistProgress.total > 0 ? (
                                <span className="flex items-center gap-1 text-[10.5px] font-semibold text-faint">
                                  <CheckSquare size={11} aria-hidden />
                                  {card.checklistProgress.done}/
                                  {card.checklistProgress.total}
                                </span>
                              ) : null}
                              {card.commentCount > 0 ? (
                                <span className="flex items-center gap-1 text-[10.5px] font-semibold text-faint">
                                  <MessageSquare size={11} aria-hidden />
                                  {card.commentCount}
                                </span>
                              ) : null}
                              {card.attachmentCount > 0 ? (
                                <span className="flex items-center gap-1 text-[10.5px] font-semibold text-faint">
                                  <Paperclip size={11} aria-hidden />
                                  {card.attachmentCount}
                                </span>
                              ) : null}
                              <span className="flex-1" />
                              {card.assigneeProfiles
                                ?.slice(0, 3)
                                .map((person) => (
                                  <Avatar
                                    key={person.id}
                                    name={person.name}
                                    size="sm"
                                  />
                                ))}
                            </div>
                          </article>
                        </div>
                      );
                    })}
                  {dropTarget?.listId === list.id &&
                  dropTarget.index >=
                    list.cards.filter((c) => c.id !== dragCard?.cardId)
                      .length ? (
                    <div className="h-0.5 rounded bg-brand" />
                  ) : null}
                </div>

                {!readOnly ? (
                  <AddCardForm listId={list.id} boardId={boardId} />
                ) : null}
              </section>
            ))}

            {!readOnly ? (
              <section className="w-[85vw] max-w-[272px] shrink-0 sm:w-[272px]">
                {addingList ? (
                  <form
                    className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5 shadow-sm"
                    onSubmit={(event: FormEvent) => {
                      event.preventDefault();
                      if (newListName.trim()) addListMutation.mutate();
                    }}
                  >
                    <Input
                      value={newListName}
                      onChange={(event) => setNewListName(event.target.value)}
                      placeholder="List name"
                      autoFocus
                      maxLength={120}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      loading={addListMutation.isPending}
                    >
                      Add
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setAddingList(false)}
                    >
                      <X size={13} />
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingList(true)}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong/60 py-2.5 text-[12.5px] font-bold text-muted transition-colors hover:border-brand/60 hover:text-brand"
                  >
                    <Plus size={14} aria-hidden /> Add list
                  </button>
                )}
              </section>
            ) : null}

            {view.lists.length === 0 ? (
              <div className="m-auto rounded-xl border border-line bg-surface">
                <EmptyState
                  icon={GripVertical}
                  title="This board has no lists"
                  hint="Add a list to start adding cards."
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {openCardId ? (
        <ErrorBoundary
          name="Card Details"
          onReset={() => setOpenCardId(null)}
          fallback={
            <Modal title="Error" onClose={() => setOpenCardId(null)} size="sm">
              <ErrorBox message="Could not render card details. An unexpected error occurred." />
              <div className="mt-3 text-right">
                <Button variant="primary" onClick={() => setOpenCardId(null)}>
                  Close
                </Button>
              </div>
            </Modal>
          }
        >
          <CardModal
            cardId={openCardId}
            boardId={boardId}
            onClose={() => setOpenCardId(null)}
            readOnly={readOnly}
          />
        </ErrorBoundary>
      ) : null}

      {renamingListId ? (
        <RenameListDialog
          listId={renamingListId}
          initialName={
            view.lists.find((list) => list.id === renamingListId)?.name ?? ""
          }
          onClose={() => setRenamingListId(null)}
        />
      ) : null}

      {deletingList && deletingListId ? (
        <ConfirmDialog
          title={`Delete "${deletingList.name}"?`}
          body={
            deletingList.cardCount > 0
              ? `This list holds ${deletingList.cardCount} card(s). Deleting the list also archives every card in it.`
              : "This list is empty."
          }
          confirmLabel="Delete list"
          danger
          busy={deleteListMutation.isPending}
          onConfirm={() =>
            deleteListMutation.mutate({ listId: deletingListId, force: true })
          }
          onClose={() => setDeletingListId(null)}
        />
      ) : null}

      {boardMenuOpen ? (
        <BoardSettingsDialog
          boardId={boardId}
          name={view.board.name}
          onClose={() => setBoardMenuOpen(false)}
        />
      ) : null}
    </>
  );
}

function AddCardForm({ listId, boardId }: { listId: string; boardId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => cardsApi.create(listId, { title }),
    onSuccess: () => {
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
    onError: (err: ApiError) => toast.error("Could not add card", err.message),
  });

  if (!open) {
    return (
      <div className="shrink-0 p-2.5 pt-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-bold text-faint transition-colors hover:bg-sunken hover:text-ink"
        >
          <Plus size={13} aria-hidden /> Add card
        </button>
      </div>
    );
  }

  return (
    <form
      className="shrink-0 space-y-2 p-2.5 pt-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim()) mutation.mutate();
      }}
    >
      <Textarea
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Card title"
        autoFocus
        maxLength={200}
        className="min-h-[54px]"
      />
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={mutation.isPending}
          disabled={!title.trim()}
        >
          Add card
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RenameListDialog({
  listId,
  initialName,
  onClose,
}: {
  listId: string;
  initialName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { boardId = "" } = useParams();
  const [name, setName] = useState(initialName);

  const mutation = useMutation({
    mutationFn: () => boardsApi.updateList(listId, { name }),
    onSuccess: () => {
      toast.success("List renamed");
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      onClose();
    },
    onError: (err: ApiError) => toast.error("Rename failed", err.message),
  });

  return (
    <Modal
      title="Rename list"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={!name.trim()}
            onClick={() => mutation.mutate()}
          >
            Save
          </Button>
        </>
      }
    >
      <Field label="List name">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          autoFocus
        />
      </Field>
    </Modal>
  );
}

function BoardSettingsDialog({
  boardId,
  name,
  onClose,
}: {
  boardId: string;
  name: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [boardName, setBoardName] = useState(name);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const rename = useMutation({
    mutationFn: () => boardsApi.update(boardId, { name: boardName }),
    onSuccess: () => {
      toast.success("Board updated");
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      void queryClient.invalidateQueries({ queryKey: ["boards"] });
      onClose();
    },
    onError: (err: ApiError) => toast.error("Update failed", err.message),
  });

  const remove = useMutation({
    mutationFn: () => boardsApi.remove(boardId),
    onSuccess: () => {
      toast.success("Board deleted");
      void queryClient.invalidateQueries({ queryKey: ["boards"] });
      navigate("/");
    },
    onError: (err: ApiError) => toast.error("Delete failed", err.message),
  });

  return (
    <>
      <Modal
        title="Board settings"
        onClose={onClose}
        size="sm"
        footer={
          <>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => setConfirmOpen(true)}
            >
              Delete board
            </Button>
            <span className="flex-1" />
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              loading={rename.isPending}
              disabled={!boardName.trim()}
              onClick={() => rename.mutate()}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Board name">
          <Input
            value={boardName}
            onChange={(event) => setBoardName(event.target.value)}
            maxLength={120}
          />
        </Field>
      </Modal>
      {confirmOpen ? (
        <ConfirmDialog
          title="Delete this board?"
          body={`"${name}" and its lists will be moved to the trash. Cards are soft-deleted and can be restored by an admin.`}
          confirmLabel="Delete board"
          danger
          busy={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirmOpen(false)}
        />
      ) : null}
    </>
  );
}

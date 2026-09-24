/**
 * Board view — the Kanban surface.
 *
 * Drag & drop is native HTML5 DnD (no dependency). A drop resolves the two
 * neighbours around the insertion point and calls PATCH /cards/:id/move with
 * the card's current `version`; the API computes the fractional order key
 * inside a transaction. Updates are applied optimistically and rolled back if
 * the server rejects the move (409 VERSION_CONFLICT ⇒ refetch).
 */
import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { boardsApi, cardsApi } from '../api/endpoints';
import type { BoardView, Card } from '../api/types';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { CardModal } from '../components/CardModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useSocket } from '../state/socket';
import {
  Badge,
  CenterState,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Field,
  Modal,
  Spinner,
} from '../components/ui';

interface DragCard {
  cardId: string;
  fromListId: string;
}

interface DropTarget {
  listId: string;
  index: number;
}

export function BoardPage() {
  const { boardId = '' } = useParams();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const [dragCard, setDragCard] = useState<DragCard | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [dragListId, setDragListId] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);

  const readOnly = role === 'viewer';
  const { socket, joinRoom, leaveRoom } = useSocket();

  const boardQuery = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => boardsApi.view(boardId),
  });

  const view = boardQuery.data;

  // Realtime: join board room and listen for card events
  useEffect(() => {
    if (!socket || !boardId) return;
    const room = `board:${boardId}`;
    void joinRoom(room).catch(() => undefined);

    const onCardMoved = () => {
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    };
    const onCardUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    };
    const onCardCreated = () => {
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    };
    const onCardDeleted = () => {
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    };

    socket.on('card:moved', onCardMoved);
    socket.on('card:updated', onCardUpdated);
    socket.on('card:created', onCardCreated);
    socket.on('card:deleted', onCardDeleted);
    socket.on('list:reordered', onCardMoved);
    socket.on('list:rebalanced', onCardMoved);

    return () => {
      socket.off('card:moved', onCardMoved);
      socket.off('card:updated', onCardUpdated);
      socket.off('card:created', onCardCreated);
      socket.off('card:deleted', onCardDeleted);
      socket.off('list:reordered', onCardMoved);
      socket.off('list:rebalanced', onCardMoved);
      void leaveRoom(room).catch(() => undefined);
    };
  }, [socket, boardId, joinRoom, leaveRoom, queryClient]);

  /** Push a locally-moved card into the cached board view (optimistic). */
  const applyLocalMove = (cardId: string, toListId: string, index: number, movedCard?: Card) => {
    queryClient.setQueryData<BoardView>(['board', boardId], (current) => {
      if (!current) return current;
      let moving = movedCard;
      const lists = current.lists.map((list) => {
        const without = list.cards.filter((card) => card.id !== cardId);
        if (!moving) moving = list.cards.find((card) => card.id === cardId);
        return { ...list, cards: without };
      });
      if (!moving) return current;
      const next = lists.map((list) => {
        if (list.id !== toListId) return list;
        const cards = [...list.cards];
        cards.splice(Math.max(0, Math.min(index, cards.length)), 0, { ...moving as Card, listId: toListId });
        return { ...list, cards };
      });
      return {
        ...current,
        lists: next.map((list) => ({
          ...list,
          cardCount: list.cards.length,
        })),
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
    }) => cardsApi.move(cardId, version, { targetListId, beforeCardId, afterCardId }),
    onSuccess: (moved) => {
      // Reconcile with the authoritative card (new `version`, new `order`).
      queryClient.setQueryData<BoardView>(['board', boardId], (current) => {
        if (!current) return current;
        return {
          ...current,
          lists: current.lists.map((list) => ({
            ...list,
            cards: list.cards.map((card) => (card.id === moved.id ? { ...card, ...moved, listId: moved.listId } : card)),
            cardCount: list.cards.length,
          })),
        };
      });
    },
    onError: (err: ApiError) => {
      toast.error(
        err.code === 'VERSION_CONFLICT' ? 'Card changed elsewhere' : 'Move failed',
        err.message,
      );
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    if (!dragCard || !dropTarget || !view) return;

    const source = view.lists.find((list) => list.id === dragCard.fromListId);
    const card = source?.cards.find((item) => item.id === dragCard.cardId);
    const target = view.lists.find((list) => list.id === dropTarget.listId);
    if (!card || !target) return;

    // Neighbours are taken from the target list WITHOUT the dragged card, so a
    // reorder inside the same list resolves correctly.
    const siblings = target.cards.filter((item) => item.id !== dragCard.cardId);
    const index = Math.max(0, Math.min(dropTarget.index, siblings.length));
    const beforeCardId = index > 0 ? (siblings[index - 1]?.id ?? null) : null;
    const afterCardId = index < siblings.length ? (siblings[index]?.id ?? null) : null;

    const sameList = dragCard.fromListId === dropTarget.listId;
    const currentIndex = source?.cards.findIndex((item) => item.id === dragCard.cardId) ?? -1;
    if (sameList && (currentIndex === index)) {
      setDragCard(null);
      setDropTarget(null);
      return; // No-op drop — nothing changed.
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
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['board', boardId] }),
    onError: (err: ApiError) => toast.error('Reorder failed', err.message),
  });

  const handleListDrop = (event: DragEvent, overListId: string) => {
    event.preventDefault();
    if (!dragListId || !view || dragListId === overListId) return;
    const ids = view.lists.map((list) => list.id);
    const from = ids.indexOf(dragListId);
    const to = ids.indexOf(overListId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    queryClient.setQueryData<BoardView>(['board', boardId], (current) => {
      if (!current) return current;
      const byId = new Map(current.lists.map((list) => [list.id, list]));
      return { ...current, lists: ids.map((id) => byId.get(id)!).filter(Boolean) };
    });
    reorderListsMutation.mutate(ids);
    setDragListId(null);
  };

  const addListMutation = useMutation({
    mutationFn: () => boardsApi.createList(boardId, { name: newListName }),
    onSuccess: () => {
      setNewListName('');
      setAddingList(false);
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
    onError: (err: ApiError) => toast.error('Could not add list', err.message),
  });

  const deleteListMutation = useMutation({
    mutationFn: ({ listId, force }: { listId: string; force: boolean }) => boardsApi.removeList(listId, force),
    onSuccess: () => {
      setDeletingListId(null);
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      toast.success('List deleted');
    },
    onError: (err: ApiError) => toast.error('Could not delete list', err.message),
  });

  const deletingList = useMemo(
    () => view?.lists.find((list) => list.id === deletingListId) ?? null,
    [view, deletingListId],
  );

  if (boardQuery.isLoading) return <CenterState>Loading board…</CenterState>;
  if (boardQuery.isError) {
    return (
      <div className="page">
        <ErrorBox
          message={(boardQuery.error as ApiError)?.message ?? 'Could not load this board'}
          requestId={(boardQuery.error as ApiError)?.requestId}
        />
        <button type="button" className="btn" onClick={() => navigate('/')}>
          ← Back to boards
        </button>
      </div>
    );
  }
  if (!view) return null;

  return (
    <>
      <div className="topbar" style={{ borderBottom: '1px solid var(--border)' }}>
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => navigate('/')} aria-label="Back">
          ←
        </button>
        <strong>{view.board.name}</strong>
        {view.board.visibility === 'private' ? <Badge tone="warning">private</Badge> : null}
        <span className="faint" style={{ fontSize: 12.5 }}>
          {view.board.stats.cardCount} cards · {view.lists.length} lists
        </span>
        <div className="topbar__spacer" />
        {!readOnly ? (
          <button type="button" className="btn btn--sm" onClick={() => setBoardMenuOpen(true)}>
            Board settings
          </button>
        ) : null}
      </div>

      <div
        className="page page--flush"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="kanban">
          {view.lists.map((list) => (
            <section
              key={list.id}
              className="kanban__list"
              onDragOver={(event) => {
                if (!dragListId) return;
                event.preventDefault();
              }}
              onDrop={(event) => handleListDrop(event, list.id)}
            >
              <header
                className="kanban__list-head"
                draggable={!readOnly}
                onDragStart={() => setDragListId(list.id)}
                onDragEnd={() => setDragListId(null)}
                style={{ cursor: readOnly ? 'default' : 'grab' }}
              >
                <span className="faint">⠿</span>
                <button
                  type="button"
                  className="kanban__list-title"
                  style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => setRenamingListId(list.id)}
                  title="Rename list"
                >
                  {list.name}
                </button>
                <span className="kanban__count">{list.cards.length}</span>
                {list.wipLimit && list.cards.length > list.wipLimit ? <Badge tone="danger">WIP</Badge> : null}
                {!readOnly ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    onClick={() => setDeletingListId(list.id)}
                    aria-label={`Delete ${list.name}`}
                  >
                    ×
                  </button>
                ) : null}
              </header>

              <div
                className={`kanban__cards${dropTarget?.listId === list.id ? ' kanban__cards--over' : ''}`}
                onDragOver={(event) => {
                  if (!dragCard) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDropTarget({ listId: list.id, index: list.cards.filter((c) => c.id !== dragCard.cardId).length });
                }}
              >
                {list.cards
                  .filter((card) => card.id !== dragCard?.cardId || dropTarget?.listId !== list.id)
                  .map((card) => {
                    const siblings = list.cards.filter((item) => item.id !== dragCard?.cardId);
                    const visualIndex = siblings.findIndex((item) => item.id === card.id);
                    return (
                      <div key={card.id}>
                        {dropTarget?.listId === list.id && dropTarget.index === visualIndex ? (
                          <div className="drop-indicator" />
                        ) : null}
                        <article
                          className={`card${dragCard?.cardId === card.id ? ' card--dragging' : ''}${card.completedAt ? ' card--completed' : ''}`}
                          draggable={!readOnly}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', card.id);
                            setDragCard({ cardId: card.id, fromListId: list.id });
                          }}
                          onDragEnd={() => {
                            setDragCard(null);
                            setDropTarget(null);
                          }}
                          onDragOver={(event) => {
                            if (!dragCard || dragCard.cardId === card.id) return;
                            event.preventDefault();
                            event.stopPropagation();
                            const rect = event.currentTarget.getBoundingClientRect();
                            const after = event.clientY - rect.top > rect.height / 2;
                            setDropTarget({ listId: list.id, index: visualIndex + (after ? 1 : 0) });
                          }}
                          onClick={() => setOpenCardId(card.id)}
                        >
                          {card.labels.length > 0 ? (
                            <div className="card__labels">
                              {card.labels.slice(0, 3).map((label) => (
                                <span key={label.id} className="label-chip" style={{ background: label.color }}>
                                  {label.name}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="card__title">{card.title}</div>
                          <div className="card__meta">
                            {card.priority !== 'none' ? (
                              <Badge tone={card.priority === 'urgent' ? 'danger' : card.priority === 'high' ? 'warning' : 'default'}>
                                {card.priority}
                              </Badge>
                            ) : null}
                            {card.dueAt ? (
                              <span title="Due date">
                                ⏰ {new Date(card.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            ) : null}
                            {card.checklistProgress.total > 0 ? (
                              <span title="Checklist progress">
                                ☑ {card.checklistProgress.done}/{card.checklistProgress.total}
                              </span>
                            ) : null}
                            {card.commentCount > 0 ? <span title="Comments">💬 {card.commentCount}</span> : null}
                            <span className="card__spacer" />
                            {card.assigneeProfiles && card.assigneeProfiles.length > 0 ? (
                              <span className="avatar-stack">
                                {card.assigneeProfiles.slice(0, 3).map((person) => (
                                  <span key={person.id} className="avatar" title={person.name} style={{ width: 20, height: 20, fontSize: 9 }}>
                                    {person.name[0]?.toUpperCase()}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </div>
                        </article>
                      </div>
                    );
                  })}
                {dropTarget?.listId === list.id &&
                dropTarget.index >= list.cards.filter((c) => c.id !== dragCard?.cardId).length ? (
                  <div className="drop-indicator" />
                ) : null}
                {list.cards.length === 0 ? (
                  <div className="faint" style={{ fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>
                    Drop cards here
                  </div>
                ) : null}
              </div>

              {!readOnly ? <AddCardForm listId={list.id} boardId={boardId} /> : null}
            </section>
          ))}

          {!readOnly ? (
            <section className="kanban__list" style={{ width: 260 }}>
              {addingList ? (
                <form
                  className="kanban__list-head"
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    if (newListName.trim()) addListMutation.mutate();
                  }}
                >
                  <input
                    className="input"
                    value={newListName}
                    onChange={(event) => setNewListName(event.target.value)}
                    placeholder="List name"
                    autoFocus
                    maxLength={120}
                  />
                  <button type="submit" className="btn btn--primary btn--sm" disabled={addListMutation.isPending}>
                    {addListMutation.isPending ? <Spinner /> : 'Add'}
                  </button>
                  <button type="button" className="btn btn--ghost btn--icon" onClick={() => setAddingList(false)}>
                    ×
                  </button>
                </form>
              ) : (
                <button type="button" className="btn btn--ghost btn--block" onClick={() => setAddingList(true)}>
                  + Add list
                </button>
              )}
            </section>
          ) : null}

          {view.lists.length === 0 ? (
            <div className="panel" style={{ margin: 'auto' }}>
              <EmptyState icon="▦" title="This board has no lists" hint="Add a list to start adding cards." />
            </div>
          ) : null}
        </div>
      </div>

      {openCardId ? (
        <ErrorBoundary
          name="Card Details"
          onReset={() => setOpenCardId(null)}
          fallback={
            <Modal title="Error" onClose={() => setOpenCardId(null)} wide={false}>
              <ErrorBox message="Could not render card details. An unexpected error occurred." />
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <button type="button" className="btn btn--primary" onClick={() => setOpenCardId(null)}>
                  Close
                </button>
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
          initialName={view.lists.find((list) => list.id === renamingListId)?.name ?? ''}
          onClose={() => setRenamingListId(null)}
        />
      ) : null}

      {deletingList && deletingListId ? (
        <ConfirmDialog
          title={`Delete "${deletingList.name}"?`}
          body={
            deletingList.cardCount > 0
              ? `This list holds ${deletingList.cardCount} card(s). Deleting the list also archives every card in it.`
              : 'This list is empty.'
          }
          confirmLabel="Delete list"
          danger
          busy={deleteListMutation.isPending}
          onConfirm={() => deleteListMutation.mutate({ listId: deletingListId, force: true })}
          onClose={() => setDeletingListId(null)}
        />
      ) : null}

      {boardMenuOpen ? <BoardSettingsDialog boardId={boardId} name={view.board.name} onClose={() => setBoardMenuOpen(false)} /> : null}
    </>
  );
}

function AddCardForm({ listId, boardId }: { listId: string; boardId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => cardsApi.create(listId, { title }),
    onSuccess: () => {
      setTitle('');
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
    onError: (err: ApiError) => toast.error('Could not add card', err.message),
  });

  if (!open) {
    return (
      <div className="kanban__list-foot">
        <button type="button" className="btn btn--ghost btn--sm btn--block" onClick={() => setOpen(true)}>
          + Add card
        </button>
      </div>
    );
  }

  return (
    <form
      className="kanban__list-foot"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim()) mutation.mutate();
      }}
    >
      <textarea
        className="textarea"
        style={{ minHeight: 54 }}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Card title"
        autoFocus
        maxLength={200}
      />
      <div className="row" style={{ marginTop: 8 }}>
        <button type="submit" className="btn btn--primary btn--sm" disabled={mutation.isPending || !title.trim()}>
          {mutation.isPending ? <Spinner /> : 'Add card'}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RenameListDialog({ listId, initialName, onClose }: { listId: string; initialName: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { boardId = '' } = useParams();
  const [name, setName] = useState(initialName);

  const mutation = useMutation({
    mutationFn: () => boardsApi.updateList(listId, { name }),
    onSuccess: () => {
      toast.success('List renamed');
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      onClose();
    },
    onError: (err: ApiError) => toast.error('Rename failed', err.message),
  });

  return (
    <Modal
      title="Rename list"
      onClose={onClose}
      wide={false}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={mutation.isPending || !name.trim()} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Spinner /> : null}
            Save
          </button>
        </>
      }
    >
      <Field label="List name">
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoFocus />
      </Field>
    </Modal>
  );
}

function BoardSettingsDialog({ boardId, name, onClose }: { boardId: string; name: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [boardName, setBoardName] = useState(name);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const rename = useMutation({
    mutationFn: () => boardsApi.update(boardId, { name: boardName }),
    onSuccess: () => {
      toast.success('Board updated');
      void queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      void queryClient.invalidateQueries({ queryKey: ['boards'] });
      onClose();
    },
    onError: (err: ApiError) => toast.error('Update failed', err.message),
  });

  const remove = useMutation({
    mutationFn: () => boardsApi.remove(boardId),
    onSuccess: () => {
      toast.success('Board deleted');
      void queryClient.invalidateQueries({ queryKey: ['boards'] });
      navigate('/');
    },
    onError: (err: ApiError) => toast.error('Delete failed', err.message),
  });

  return (
    <>
      <Modal
        title="Board settings"
        onClose={onClose}
        wide={false}
        footer={
          <>
            <button type="button" className="btn btn--danger" onClick={() => setConfirmOpen(true)}>
              Delete board
            </button>
            <span className="grow" />
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn btn--primary" disabled={rename.isPending || !boardName.trim()} onClick={() => rename.mutate()}>
              {rename.isPending ? <Spinner /> : null}
              Save
            </button>
          </>
        }
      >
        <Field label="Board name">
          <input className="input" value={boardName} onChange={(event) => setBoardName(event.target.value)} maxLength={120} />
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

/**
 * Boards index — the workspace landing page.
 * Lists boards the caller may see (private boards are filtered server-side),
 * and hosts the "create board" and "create workspace" flows.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { boardsApi, workspacesApi } from '../api/endpoints';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { Badge, CenterState, ConfirmDialog, EmptyState, ErrorBox, Field, Modal, Spinner } from '../components/ui';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function BoardsPage() {
  const { workspaceId, workspace, user, role, refreshWorkspaces, selectWorkspace } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [layout, setLayout] = useState('grid');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem('orbit.favorites') ?? '[]'); return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []; } catch { return []; }
  });
  const canCreate = ['owner', 'admin', 'manager'].includes(role ?? '');
  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter((value) => value !== id) : [...favorites, id];
    setFavorites(next);
    try { localStorage.setItem('orbit.favorites', JSON.stringify(next)); } catch { toast.info('Favorites saved for this visit', 'Browser storage is unavailable.'); }
  };
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const boardsQuery = useQuery({
    queryKey: ['boards', workspaceId],
    queryFn: () => boardsApi.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  if (!workspaceId) {
    return (
      <div className="page">
        <div className="panel" style={{ maxWidth: 560, margin: '48px auto' }}>
          <EmptyState
            icon="◎"
            title="Create your first workspace"
            hint="A workspace holds your boards, members and invitations. Creating one makes you its owner and seeds a Getting Started board."
            action={
              <button type="button" className="btn btn--primary" onClick={() => setWorkspaceOpen(true)}>
                Create workspace
              </button>
            }
          />
        </div>
        {workspaceOpen ? (
          <CreateWorkspaceDialog
            onClose={() => setWorkspaceOpen(false)}
            onCreated={async (id) => {
              await refreshWorkspaces();
              await selectWorkspace(id);
              setWorkspaceOpen(false);
              toast.success('Workspace created');
            }}
          />
        ) : null}
      </div>
    );
  }

  const boards = boardsQuery.data?.boards ?? [];
  const visible = boards.filter((board) => (!onlyFavorites || favorites.includes(board.id)) && `${board.name} ${board.description ?? ''}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'cards' ? b.stats.cardCount - a.stats.cardCount : Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return (
    <div className="page dashboard">
      <section className="welcome-banner">
        <div><span className="eyebrow">YOUR WORKSPACE, IN SYNC</span><h1>Make room for your best work.</h1><p>Welcome back, {user?.name.split(' ')[0] ?? 'there'}. Pick a board and keep things moving.</p><button className="btn" onClick={() => setWorkspaceOpen(true)}>＋ Create workspace</button></div>
        <div className="orbit-art" aria-hidden="true"><i /><i /><span>O</span><b>✦</b></div>
      </section>
      <div className="overview-grid">
        {[['▦', 'Boards', boardsQuery.isSuccess ? boards.length : '—'], ['▤', 'Cards', boardsQuery.isSuccess ? boards.reduce((sum, board) => sum + board.stats.cardCount, 0) : '—'], ['◍', 'Workspace members', workspace?.stats.memberCount ?? '—'], ['☆', 'Favorite boards', boardsQuery.isSuccess ? boards.filter((board) => favorites.includes(board.id)).length : '—']].map(([icon, label, value]) => <div className="overview-stat" key={label}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>)}
      </div>
      <div className="page__header">
        <div className="page__header-text">
          <h2>Your boards</h2>
          <p className="page__subtitle">
            {workspace?.name} · {boardsQuery.data?.boards.length ?? 0} board(s)
          </p>
        </div>
        <button type="button" disabled={!canCreate} title={!canCreate ? "Only managers, admins and owners can create boards" : undefined} className="btn btn--primary" onClick={() => setCreateOpen(true)}>
          + New board
        </button>
      </div>

      <div className="board-toolbar">
        <label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your boards…" aria-label="Search boards" />{search && <button onClick={() => setSearch('')} aria-label="Clear search">×</button>}</label>
        <button className={`btn ${onlyFavorites ? 'filter-active' : ''}`} aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(!onlyFavorites)}>☆ Favorites</button>
        <select className="select sort-select" aria-label="Sort boards" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Recently updated</option><option value="name">Name A–Z</option><option value="cards">Most cards</option></select>
        <div className="view-toggle"><button aria-label="Grid view" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}>▦</button><button aria-label="List view" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>☰</button></div>
        <button className="btn" disabled={boardsQuery.isFetching} onClick={() => void boardsQuery.refetch()} aria-label="Refresh boards">↻</button>
      </div>
      {boardsQuery.isSuccess && boards.length > 0 && visible.length === 0 ? <EmptyState title="No matching boards" hint="Try another search or turn off the favorites filter." action={<button className="btn" onClick={() => { setSearch(''); setOnlyFavorites(false); }}>Clear filters</button>} /> : null}
      {boardsQuery.isError ? (
        <ErrorBox
          message={(boardsQuery.error as ApiError)?.message ?? 'Could not load boards'}
          requestId={(boardsQuery.error as ApiError)?.requestId}
        />
      ) : null}

      {boardsQuery.isLoading ? <CenterState>Loading boards…</CenterState> : null}

      {boardsQuery.data && boardsQuery.data.boards.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon="▦"
            title="No boards yet"
            hint="Create a board to start organising work into lists and cards."
            action={
              <button type="button" disabled={!canCreate} className="btn btn--primary" onClick={() => setCreateOpen(true)}>
                + New board
              </button>
            }
          />
        </div>
      ) : null}

      {boardsQuery.data && boardsQuery.data.boards.length > 0 ? (
        <div className={`grid grid--boards ${layout === 'list' ? 'boards-list-view' : ''}`}>
          {visible.map((board, index) => (
            <article key={board.id} className="board-tile" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
              <div className={`board-cover cover-${index % 4}`}><span aria-hidden="true">▦</span><button className="favorite-button" aria-label={`${favorites.includes(board.id) ? 'Unfavorite' : 'Favorite'} ${board.name}`} aria-pressed={favorites.includes(board.id)} onClick={() => toggleFavorite(board.id)}>{favorites.includes(board.id) ? '★' : '☆'}</button></div>
              <button className="board-open board-tile__name" onClick={() => navigate(`/boards/${board.id}`)}>{board.name}<span aria-hidden="true">↗</span></button>
              <span className="muted" style={{ fontSize: 12.5, minHeight: 18 }}>
                {board.description ?? ''}
              </span>
              <span className="board-tile__meta">
                <span>{board.stats.listCount} lists</span>
                <span>·</span>
                <span>{board.stats.cardCount} cards</span>
                <span className="grow" />
                {board.visibility === 'private' ? <Badge tone="warning">private</Badge> : null}
              </span>
              <small className="faint">Updated {new Date(board.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
            </article>
          ))}
        </div>
      ) : null}

      {workspaceOpen ? <CreateWorkspaceDialog onClose={() => setWorkspaceOpen(false)} onCreated={async (id) => { await refreshWorkspaces(); await selectWorkspace(id); setWorkspaceOpen(false); }} /> : null}
      {createOpen ? (
        <CreateBoardDialog
          workspaceId={workspaceId}
          onClose={() => setCreateOpen(false)}
          onCreated={(board) => {
            setCreateOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['boards', workspaceId] });
            navigate(`/boards/${board.id}`);
          }}
        />
      ) : null}
    </div>
  );
}

function CreateBoardDialog({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: (board: { id: string }) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'workspace' | 'private'>('workspace');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => boardsApi.create(workspaceId, { name, description: description || undefined, visibility }),
    onSuccess: (board) => {
      toast.success('Board created', board.name);
      onCreated(board);
    },
    onError: (err: ApiError) => setError(err.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal
      title="New board"
      onClose={onClose}
      wide={false}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit} disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending ? <Spinner /> : null}
            Create board
          </button>
        </>
      }
    >
      {error ? <ErrorBox message={error} /> : null}
      <form onSubmit={submit}>
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus required />
        </Field>
        <Field label="Description" hint="Optional.">
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </Field>
        <Field label="Visibility" hint="Private boards are visible only to members you add explicitly.">
          <select className="select" value={visibility} onChange={(e) => setVisibility(e.target.value as 'workspace' | 'private')}>
            <option value="workspace">Workspace — every member can see it</option>
            <option value="private">Private — explicit members only</option>
          </select>
        </Field>
      </form>
    </Modal>
  );
}

function CreateWorkspaceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => workspacesApi.create({ name, slug: slug || slugify(name) }),
    onSuccess: (created) => {
      toast.success('Workspace created', `${created.name} · a Getting Started board is ready`);
      onCreated(created.id);
    },
    onError: (err: ApiError) => setError(err.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  const effectiveSlug = slug || slugify(name);

  return (
    <Modal
      title="New workspace"
      onClose={onClose}
      wide={false}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={submit}
            disabled={mutation.isPending || !name.trim() || effectiveSlug.length < 3}
          >
            {mutation.isPending ? <Spinner /> : null}
            Create workspace
          </button>
        </>
      }
    >
      {error ? <ErrorBox message={error} /> : null}
      <form onSubmit={submit}>
        <Field label="Workspace name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoFocus
            required
          />
        </Field>
        <Field label="Slug" hint="3–48 characters: lowercase letters, digits and hyphens. Must be unique.">
          <input
            className="input mono"
            value={effectiveSlug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            pattern="[a-z0-9-]+"
            minLength={3}
            maxLength={48}
          />
        </Field>
      </form>
    </Modal>
  );
}

export { ConfirmDialog };

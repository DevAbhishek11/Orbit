/**
 * Notion-style Docs/Pages screen (BUILD_PROMPT Phase 7 & 13):
 * Nested tree navigation, block-based content editor, version snapshots,
 * favourites, and autosave conflict management.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pagesApi } from '../api/endpoints';
import type { Page, PageBlock, PageVersion } from '../api/types';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { Badge, CenterState, ConfirmDialog, EmptyState, ErrorBox, Field, Modal, Spinner } from '../components/ui';

export function DocsPage() {
  const { workspaceId, role } = useAuth();
  const { pageId } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [parentForNewPage, setParentForNewPage] = useState<string | null>(null);
  const [versionsModalOpen, setVersionsModalOpen] = useState(false);

  const readOnly = role === 'viewer';

  // Load page tree
  const treeQuery = useQuery({
    queryKey: ['pages-tree', workspaceId],
    queryFn: () => pagesApi.tree(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const pages = useMemo(() => treeQuery.data?.pages ?? [], [treeQuery.data]);

  // If no pageId is selected but pages exist, select the first page
  useEffect(() => {
    if (!pageId && pages.length > 0 && pages[0]?.id) {
      navigate(`/docs/${pages[0].id}`, { replace: true });
    }
  }, [pageId, pages, navigate]);

  // Load active page
  const pageQuery = useQuery({
    queryKey: ['page', pageId],
    queryFn: () => pagesApi.get(pageId as string),
    enabled: Boolean(pageId),
  });

  const activePage = pageQuery.data?.page;

  // Create page mutation
  const createMutation = useMutation({
    mutationFn: (data: { title: string; parentId?: string | null }) =>
      pagesApi.create(workspaceId as string, data),
    onSuccess: (res) => {
      toast.success('Doc created');
      void queryClient.invalidateQueries({ queryKey: ['pages-tree', workspaceId] });
      setCreateModalOpen(false);
      setNewPageTitle('');
      setParentForNewPage(null);
      navigate(`/docs/${res.page.id}`);
    },
    onError: (err: Error) => toast.error('Could not create doc', err.message),
  });

  return (
    <div className="docs-layout" style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
      {/* Sidebar: Tree view */}
      <aside
        className="docs-sidebar"
        style={{
          width: 280,
          borderRight: '1px solid var(--border)',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-muted, var(--surface))',
          overflowY: 'auto',
        }}
      >
        <div className="row row--between" style={{ marginBottom: 12 }}>
          <strong style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Docs & Wiki</strong>
          {!readOnly && (
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              title="New Doc"
              onClick={() => {
                setParentForNewPage(null);
                setCreateModalOpen(true);
              }}
            >
              +
            </button>
          )}
        </div>

        {treeQuery.isLoading && <Spinner />}

        <nav className="stack" style={{ gap: 2 }}>
          {pages.map((p) => {
            const isSelected = p.id === pageId;
            const indent = Math.min((p.depth ?? 0) * 14, 56);
            return (
              <div
                key={p.id}
                className="row row--between"
                style={{
                  paddingLeft: indent,
                  borderRadius: 6,
                  background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                }}
              >
                <button
                  type="button"
                  className="btn btn--ghost grow"
                  style={{
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    gap: 6,
                    padding: '6px 8px',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                  onClick={() => navigate(`/docs/${p.id}`)}
                >
                  <span>{p.icon || '📄'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title || 'Untitled'}
                  </span>
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    style={{ width: 22, height: 22, opacity: 0.6 }}
                    title="Add sub-page"
                    onClick={(e) => {
                      e.stopPropagation();
                      setParentForNewPage(p.id);
                      setCreateModalOpen(true);
                    }}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
          {pages.length === 0 && !treeQuery.isLoading && (
            <p className="faint" style={{ fontSize: 12.5, margin: '12px 0' }}>
              No docs yet. Create your first doc!
            </p>
          )}
        </nav>
      </aside>

      {/* Main editor area */}
      <main className="docs-content grow" style={{ overflowY: 'auto', padding: '32px 48px' }}>
        {pageQuery.isLoading && (
          <CenterState>
            <Spinner large />
            <div>Loading doc…</div>
          </CenterState>
        )}

        {pageQuery.isError && (
          <ErrorBox
            message="Could not load page"
            requestId={(pageQuery.error as { requestId?: string })?.requestId}
          />
        )}

        {!pageId && pages.length === 0 && !treeQuery.isLoading && (
          <EmptyState
            icon="📄"
            title="Knowledge Base & Docs"
            hint="Create nested docs, wikis, and structured notes with version history."
            action={
              <button type="button" className="btn btn--primary" onClick={() => setCreateModalOpen(true)}>
                + New Document
              </button>
            }
          />
        )}

        {activePage && (
          <DocEditor
            key={activePage.id}
            activePage={activePage}
            readOnly={readOnly}
            workspaceId={workspaceId!}
            onOpenVersions={() => setVersionsModalOpen(true)}
            onDeleted={() => navigate('/docs')}
          />
        )}
      </main>

      {/* Create page dialog */}
      {createModalOpen && (
        <Modal title="Create New Document" onClose={() => setCreateModalOpen(false)} wide={false}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newPageTitle.trim()) {
                createMutation.mutate({
                  title: newPageTitle.trim(),
                  parentId: parentForNewPage,
                });
              }
            }}
            className="stack"
            style={{ gap: 12 }}
          >
            <Field label="Title">
              <input
                className="input"
                autoFocus
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                placeholder="e.g. Product Requirements or Team Wiki"
              />
            </Field>
            {parentForNewPage && (
              <p className="faint" style={{ fontSize: 12 }}>
                This doc will be nested under selected parent.
              </p>
            )}
            <div className="row row--end" style={{ gap: 8, marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!newPageTitle.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? <Spinner /> : 'Create Doc'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Version history modal */}
      {versionsModalOpen && pageId && (
        <VersionHistoryModal pageId={pageId} onClose={() => setVersionsModalOpen(false)} />
      )}
    </div>
  );
}

function DocEditor({
  activePage,
  readOnly,
  workspaceId,
  onOpenVersions,
  onDeleted,
}: {
  activePage: Page;
  readOnly: boolean;
  workspaceId: string;
  onOpenVersions: () => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = useState(activePage.title);
  const [blocks, setBlocks] = useState<PageBlock[]>(
    activePage.blocks?.length
      ? activePage.blocks
      : [{ id: 'b1', type: 'paragraph', content: '', order: 'V' }],
  );
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(new Date(activePage.updatedAt));
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Save page mutation
  const saveMutation = useMutation({
    mutationFn: (data: { title: string; blocks: PageBlock[]; version: number }) =>
      pagesApi.update(activePage.id, data.version, { title: data.title, blocks: data.blocks }),
    onSuccess: (res) => {
      setIsDirty(false);
      setLastSavedAt(new Date());
      queryClient.setQueryData(['page', activePage.id], res);
      void queryClient.invalidateQueries({ queryKey: ['pages-tree', workspaceId] });
    },
    onError: (err: { code?: string; message?: string }) => {
      if (err.code === 'VERSION_CONFLICT') {
        toast.error('Version conflict', 'Another user edited this page. Reloading latest.');
        void queryClient.invalidateQueries({ queryKey: ['page', activePage.id] });
      } else {
        toast.error('Save failed', err.message);
      }
    },
  });

  // Delete page mutation
  const deleteMutation = useMutation({
    mutationFn: () => pagesApi.remove(activePage.id),
    onSuccess: () => {
      toast.success('Doc deleted');
      void queryClient.invalidateQueries({ queryKey: ['pages-tree', workspaceId] });
      setConfirmDelete(false);
      onDeleted();
    },
    onError: (err: Error) => toast.error('Could not delete doc', err.message),
  });

  // Favourite toggle
  const favouriteMutation = useMutation({
    mutationFn: () => pagesApi.toggleFavourite(activePage.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pages-tree', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['page', activePage.id] });
    },
  });

  const handleSave = () => {
    if (!isDirty) return;
    saveMutation.mutate({
      title: title.trim() || 'Untitled',
      blocks,
      version: activePage.version,
    });
  };

  const updateBlock = (index: number, content: string) => {
    const updated = [...blocks];
    if (updated[index]) {
      updated[index] = { ...updated[index], content };
      setBlocks(updated);
      setIsDirty(true);
    }
  };

  const changeBlockType = (index: number, type: PageBlock['type']) => {
    const updated = [...blocks];
    if (updated[index]) {
      updated[index] = { ...updated[index], type };
      setBlocks(updated);
      setIsDirty(true);
    }
  };

  const toggleTodo = (index: number) => {
    const updated = [...blocks];
    if (updated[index]) {
      updated[index] = { ...updated[index], checked: !updated[index].checked };
      setBlocks(updated);
      setIsDirty(true);
    }
  };

  const addBlock = (afterIndex: number, type: PageBlock['type'] = 'paragraph') => {
    const newBlock: PageBlock = {
      id: Math.random().toString(36).slice(2, 10),
      type,
      content: '',
      order: String(Date.now()),
    };
    const updated = [...blocks];
    updated.splice(afterIndex + 1, 0, newBlock);
    setBlocks(updated);
    setIsDirty(true);
  };

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return;
    const updated = blocks.filter((_, i) => i !== index);
    setBlocks(updated);
    setIsDirty(true);
  };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      {/* Action Bar */}
      <div className="row row--between" style={{ marginBottom: 24, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontSize: 24 }}>{activePage.icon || '📄'}</span>
          <Badge tone="accent">v{activePage.version}</Badge>
          {lastSavedAt && (
            <span className="faint" style={{ fontSize: 12 }}>
              Saved {lastSavedAt.toLocaleTimeString()}
            </span>
          )}
          {isDirty && <Badge tone="warning">Unsaved changes</Badge>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            title="Toggle favourite"
            onClick={() => favouriteMutation.mutate()}
          >
            ⭐
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onOpenVersions}
          >
            Version history
          </button>
          {!readOnly && isDirty && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={saveMutation.isPending}
              onClick={handleSave}
            >
              {saveMutation.isPending ? <Spinner /> : 'Save doc'}
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              title="Delete doc"
              onClick={() => setConfirmDelete(true)}
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {/* Title field */}
      <input
        className="input"
        value={title}
        disabled={readOnly}
        onChange={(e) => {
          setTitle(e.target.value);
          setIsDirty(true);
        }}
        onBlur={handleSave}
        placeholder="Untitled Document"
        style={{
          fontSize: 28,
          fontWeight: 700,
          border: 'none',
          background: 'transparent',
          padding: '4px 0',
          marginBottom: 24,
          boxShadow: 'none',
        }}
      />

      {/* Block Editor */}
      <div className="stack" style={{ gap: 12 }}>
        {blocks.map((block, index) => (
          <div
            key={block.id || index}
            className="block-row row"
            style={{ gap: 8, alignItems: 'flex-start' }}
          >
            {/* Block Type Picker */}
            {!readOnly && (
              <select
                className="select"
                style={{ width: 100, fontSize: 11, padding: '4px 6px' }}
                value={block.type}
                onChange={(e) => changeBlockType(index, e.target.value as PageBlock['type'])}
              >
                <option value="paragraph">Text</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
                <option value="todo">To-Do</option>
                <option value="quote">Quote</option>
                <option value="code">Code</option>
                <option value="divider">Divider</option>
              </select>
            )}

            {/* Block Content */}
            <div className="grow">
              {block.type === 'h1' ? (
                <input
                  className="input"
                  value={block.content}
                  disabled={readOnly}
                  onChange={(e) => updateBlock(index, e.target.value)}
                  onBlur={handleSave}
                  placeholder="Heading 1"
                  style={{ fontSize: 22, fontWeight: 700 }}
                />
              ) : block.type === 'h2' ? (
                <input
                  className="input"
                  value={block.content}
                  disabled={readOnly}
                  onChange={(e) => updateBlock(index, e.target.value)}
                  onBlur={handleSave}
                  placeholder="Heading 2"
                  style={{ fontSize: 18, fontWeight: 600 }}
                />
              ) : block.type === 'h3' ? (
                <input
                  className="input"
                  value={block.content}
                  disabled={readOnly}
                  onChange={(e) => updateBlock(index, e.target.value)}
                  onBlur={handleSave}
                  placeholder="Heading 3"
                  style={{ fontSize: 15, fontWeight: 600 }}
                />
              ) : block.type === 'todo' ? (
                <div className="row" style={{ gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(block.checked)}
                    disabled={readOnly}
                    onChange={() => toggleTodo(index)}
                  />
                  <input
                    className="input grow"
                    value={block.content}
                    disabled={readOnly}
                    onChange={(e) => updateBlock(index, e.target.value)}
                    onBlur={handleSave}
                    placeholder="To-do item"
                    style={{ textDecoration: block.checked ? 'line-through' : 'none', opacity: block.checked ? 0.6 : 1 }}
                  />
                </div>
              ) : block.type === 'quote' ? (
                <textarea
                  className="textarea"
                  value={block.content}
                  disabled={readOnly}
                  onChange={(e) => updateBlock(index, e.target.value)}
                  onBlur={handleSave}
                  placeholder="Quote..."
                  style={{ borderLeft: '3px solid var(--accent)', fontStyle: 'italic', minHeight: 60 }}
                />
              ) : block.type === 'code' ? (
                <textarea
                  className="textarea"
                  value={block.content}
                  disabled={readOnly}
                  onChange={(e) => updateBlock(index, e.target.value)}
                  onBlur={handleSave}
                  placeholder="Code block..."
                  style={{ fontFamily: 'monospace', fontSize: 13, minHeight: 80, background: 'var(--surface-muted)' }}
                />
              ) : block.type === 'divider' ? (
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />
              ) : (
                <textarea
                  className="textarea"
                  value={block.content}
                  disabled={readOnly}
                  onChange={(e) => updateBlock(index, e.target.value)}
                  onBlur={handleSave}
                  placeholder="Type something..."
                  rows={2}
                />
              )}
            </div>

            {/* Actions */}
            {!readOnly && (
              <div className="row" style={{ gap: 4 }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  title="Add block below"
                  onClick={() => addBlock(index)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  title="Remove block"
                  onClick={() => removeBlock(index)}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <button
          type="button"
          className="btn btn--ghost"
          style={{ marginTop: 24 }}
          onClick={() => addBlock(blocks.length - 1)}
        >
          + Add block
        </button>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete document?"
          body="Deleting this doc will also soft-delete all its sub-pages. It can be restored later."
          confirmLabel="Delete doc"
          danger
          busy={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function VersionHistoryModal({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const versionsQuery = useQuery({
    queryKey: ['page-versions', pageId],
    queryFn: () => pagesApi.versions(pageId),
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => pagesApi.restoreVersion(pageId, versionId),
    onSuccess: (res) => {
      toast.success('Version restored');
      queryClient.setQueryData(['page', pageId], res);
      onClose();
    },
    onError: (err: Error) => toast.error('Restore failed', err.message),
  });

  const versions = versionsQuery.data?.versions ?? [];

  return (
    <Modal title="Version History" onClose={onClose} wide={false}>
      {versionsQuery.isLoading && <Spinner />}
      <div className="stack" style={{ gap: 8, maxHeight: 380, overflowY: 'auto' }}>
        {versions.map((v: PageVersion) => (
          <div
            key={v.id || v._id}
            className="row row--between panel"
            style={{ padding: '10px 14px' }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>v{v.version} — {v.title}</div>
              <div className="faint" style={{ fontSize: 12 }}>
                {new Date(v.createdAt).toLocaleString()} · {v.snapshotReason}
              </div>
            </div>
            <button
              type="button"
              className="btn btn--sm"
              disabled={restoreMutation.isPending}
              onClick={() => restoreMutation.mutate(v.id || v._id)}
            >
              Restore
            </button>
          </div>
        ))}
        {versions.length === 0 && !versionsQuery.isLoading && (
          <p className="faint">No previous snapshots recorded.</p>
        )}
      </div>
    </Modal>
  );
}

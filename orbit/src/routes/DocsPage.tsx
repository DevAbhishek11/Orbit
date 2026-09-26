import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FilePlus2,
  FileText,
  History,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { pagesApi } from "../api/endpoints";
import type { Page, PageBlock, PageVersion } from "../api/types";
import {
  AppIcon,
  Badge,
  Button,
  CenterState,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  Select,
  SubSidebar,
  SubSidebarToggle,
  Textarea,
} from "../components/ui";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

export function DocsPage() {
  const { workspaceId, role } = useAuth();
  const { pageId } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();

  const [docListOpen, setDocListOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [parentForNewPage, setParentForNewPage] = useState<string | null>(null);
  const [versionsModalOpen, setVersionsModalOpen] = useState(false);

  const readOnly = role === "viewer";

  const treeQuery = useQuery({
    queryKey: ["pages-tree", workspaceId],
    queryFn: () => pagesApi.tree(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const pages = useMemo(() => treeQuery.data?.pages ?? [], [treeQuery.data]);

  useEffect(() => {
    if (!pageId && pages.length > 0 && pages[0]?.id) {
      navigate(`/docs/${pages[0].id}`, { replace: true });
    }
  }, [pageId, pages, navigate]);

  const pageQuery = useQuery({
    queryKey: ["page", pageId],
    queryFn: () => pagesApi.get(pageId as string),
    enabled: Boolean(pageId),
  });

  const activePage = pageQuery.data?.page;

  const createMutation = useMutation({
    mutationFn: (data: { title: string; parentId?: string | null }) =>
      pagesApi.create(workspaceId as string, data),
    onSuccess: (res) => {
      toastSuccess("Doc created");
      void queryClient.invalidateQueries({
        queryKey: ["pages-tree", workspaceId],
      });
      setCreateModalOpen(false);
      setNewPageTitle("");
      setParentForNewPage(null);
      navigate(`/docs/${res.page.id}`);
    },
    onError: (err: Error) => toastError("Could not create doc", err.message),
  });

  return (
    <div className="flex h-[calc(90dvh-56px)] md:h-[calc(92.25dvh-56px)] min-h-0">
      <SubSidebar
        open={docListOpen}
        onClose={() => setDocListOpen(false)}
        width="w-[264px]"
      >
        <div className="mb-2 flex items-center justify-between px-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
            Docs & Wiki
          </span>
          {!readOnly ? (
            <Button
              variant="ghost"
              size="icon-sm"
              title="New doc"
              onClick={() => {
                setParentForNewPage(null);
                setCreateModalOpen(true);
              }}
            >
              <Plus size={14} />
            </Button>
          ) : null}
        </div>

        {treeQuery.isLoading ? <CenterState>Loading docs…</CenterState> : null}

        <nav className="space-y-0.5">
          {pages.map((page) => {
            const isSelected = page.id === pageId;
            const indent = Math.min((page.depth ?? 0) * 14, 56);
            return (
              <div
                key={page.id}
                className="group flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-sunken"
                style={{ paddingLeft: indent }}
              >
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/docs/${page.id}`);
                    setDocListOpen(false);
                  }}
                  className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors ${
                    isSelected
                      ? "bg-brand-soft font-bold text-brand"
                      : "font-medium text-muted hover:text-ink"
                  }`}
                >
                  <AppIcon name={page.icon} size={14} className="shrink-0" />
                  <span className="truncate">{page.title || "Untitled"}</span>
                </button>
                {!readOnly ? (
                  <button
                    type="button"
                    title="Add sub-page"
                    className="cursor-pointer rounded p-1 text-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      setParentForNewPage(page.id);
                      setCreateModalOpen(true);
                    }}
                  >
                    <Plus size={13} />
                  </button>
                ) : null}
              </div>
            );
          })}
          {pages.length === 0 && !treeQuery.isLoading ? (
            <p className="px-2 py-3 text-[12px] text-faint">
              No docs yet. Create your first doc!
            </p>
          ) : null}
        </nav>
      </SubSidebar>

      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-12">
        <div className="mb-3 md:hidden">
          <SubSidebarToggle
            onClick={() => setDocListOpen(true)}
            label="Show docs"
          />
        </div>
        {pageQuery.isLoading ? <CenterState>Loading doc…</CenterState> : null}

        {pageQuery.isError ? (
          <ErrorBox
            message="Could not load page"
            requestId={(pageQuery.error as { requestId?: string })?.requestId}
          />
        ) : null}

        {!pageId && pages.length === 0 && !treeQuery.isLoading ? (
          <EmptyState
            icon={FileText}
            title="Knowledge Base & Docs"
            hint="Create nested docs, wikis, and structured notes with version history."
            action={
              <Button
                variant="primary"
                icon={FilePlus2}
                onClick={() => setCreateModalOpen(true)}
              >
                New Document
              </Button>
            }
          />
        ) : null}

        {activePage ? (
          <DocEditor
            key={activePage.id}
            activePage={activePage}
            readOnly={readOnly}
            workspaceId={workspaceId!}
            onOpenVersions={() => setVersionsModalOpen(true)}
            onDeleted={() => navigate("/docs")}
          />
        ) : null}
      </main>

      {createModalOpen ? (
        <Modal
          title="Create New Document"
          onClose={() => setCreateModalOpen(false)}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="create-doc-form"
                disabled={!newPageTitle.trim()}
                loading={createMutation.isPending}
              >
                Create Doc
              </Button>
            </>
          }
        >
          <form
            id="create-doc-form"
            className="space-y-4"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (newPageTitle.trim()) {
                createMutation.mutate({
                  title: newPageTitle.trim(),
                  parentId: parentForNewPage,
                });
              }
            }}
          >
            <Field label="Title">
              <Input
                autoFocus
                value={newPageTitle}
                onChange={(event) => setNewPageTitle(event.target.value)}
                placeholder="e.g. Product Requirements or Team Wiki"
              />
            </Field>
            {parentForNewPage ? (
              <p className="text-[12px] text-faint">
                This doc will be nested under the selected parent.
              </p>
            ) : null}
          </form>
        </Modal>
      ) : null}

      {versionsModalOpen && pageId ? (
        <VersionHistoryModal
          pageId={pageId}
          onClose={() => setVersionsModalOpen(false)}
        />
      ) : null}
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
      : [{ id: "b1", type: "paragraph", content: "", order: "V" }],
  );
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    new Date(activePage.updatedAt),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (data: {
      title: string;
      blocks: PageBlock[];
      version: number;
    }) =>
      pagesApi.update(activePage.id, data.version, {
        title: data.title,
        blocks: data.blocks,
      }),
    onSuccess: (res) => {
      setIsDirty(false);
      setLastSavedAt(new Date());
      queryClient.setQueryData(["page", activePage.id], res);
      void queryClient.invalidateQueries({
        queryKey: ["pages-tree", workspaceId],
      });
    },
    onError: (err: { code?: string; message?: string }) => {
      if (err.code === "VERSION_CONFLICT") {
        toast.error(
          "Version conflict",
          "Another user edited this page. Reloading latest.",
        );
        void queryClient.invalidateQueries({
          queryKey: ["page", activePage.id],
        });
      } else {
        toast.error("Save failed", err.message);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => pagesApi.remove(activePage.id),
    onSuccess: () => {
      toast.success("Doc deleted");
      void queryClient.invalidateQueries({
        queryKey: ["pages-tree", workspaceId],
      });
      setConfirmDelete(false);
      onDeleted();
    },
    onError: (err: Error) => toast.error("Could not delete doc", err.message),
  });

  const favouriteMutation = useMutation({
    mutationFn: () => pagesApi.toggleFavourite(activePage.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["pages-tree", workspaceId],
      });
      void queryClient.invalidateQueries({ queryKey: ["page", activePage.id] });
    },
  });

  const handleSave = () => {
    if (!isDirty) return;
    saveMutation.mutate({
      title: title.trim() || "Untitled",
      blocks,
      version: activePage.version,
    });
  };

  const updateBlock = (index: number, content: string) => {
    setBlocks((current) =>
      current.map((block, i) => (i === index ? { ...block, content } : block)),
    );
    setIsDirty(true);
  };

  const changeBlockType = (index: number, type: PageBlock["type"]) => {
    setBlocks((current) =>
      current.map((block, i) => (i === index ? { ...block, type } : block)),
    );
    setIsDirty(true);
  };

  const toggleTodo = (index: number) => {
    setBlocks((current) =>
      current.map((block, i) =>
        i === index ? { ...block, checked: !block.checked } : block,
      ),
    );
    setIsDirty(true);
  };

  const addBlock = (
    afterIndex: number,
    type: PageBlock["type"] = "paragraph",
  ) => {
    const newBlock: PageBlock = {
      id: Math.random().toString(36).slice(2, 10),
      type,
      content: "",
      order: String(Date.now()),
    };
    setBlocks((current) => {
      const next = [...current];
      next.splice(afterIndex + 1, 0, newBlock);
      return next;
    });
    setIsDirty(true);
  };

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return;
    setBlocks((current) => current.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const isFavourite = Boolean(activePage.favouriteOf?.length);

  return (
    <div className="mx-auto max-w-[840px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <AppIcon name={activePage.icon} size={16} />
          </span>
          <Badge tone="brand">v{activePage.version}</Badge>
          {lastSavedAt ? (
            <span className="text-[11.5px] text-faint">
              Saved {lastSavedAt.toLocaleTimeString()}
            </span>
          ) : null}
          {isDirty ? <Badge tone="warning">Unsaved changes</Badge> : null}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={isFavourite ? "soft" : "ghost"}
            size="icon-sm"
            title="Toggle favourite"
            onClick={() => favouriteMutation.mutate()}
          >
            <Star size={14} fill={isFavourite ? "currentColor" : "none"} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={History}
            onClick={onOpenVersions}
          >
            Version history
          </Button>
          {!readOnly && isDirty ? (
            <Button
              variant="primary"
              size="sm"
              loading={saveMutation.isPending}
              onClick={handleSave}
            >
              Save doc
            </Button>
          ) : null}
          {!readOnly ? (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Delete doc"
              className="text-danger hover:bg-danger-soft hover:text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      <input
        value={title}
        disabled={readOnly}
        onChange={(event) => {
          setTitle(event.target.value);
          setIsDirty(true);
        }}
        onBlur={handleSave}
        placeholder="Untitled Document"
        className="mb-6 w-full bg-transparent text-[26px] font-extrabold tracking-tight text-ink placeholder:text-faint focus:outline-none disabled:opacity-70"
      />

      <div className="space-y-2.5">
        {blocks.map((block, index) => (
          <div
            key={block.id || index}
            className="group flex flex-col items-stretch gap-2 sm:flex-row sm:items-start"
          >
            {!readOnly ? (
              <Select
                value={block.type}
                onChange={(event) =>
                  changeBlockType(
                    index,
                    event.target.value as PageBlock["type"],
                  )
                }
                className="w-full shrink-0 pt-0.5 sm:w-[104px]"
                aria-label="Block type"
              >
                <option value="paragraph">Text</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
                <option value="todo">To-Do</option>
                <option value="quote">Quote</option>
                <option value="code">Code</option>
                <option value="divider">Divider</option>
              </Select>
            ) : null}

            <div className="min-w-0 flex-1">
              {block.type === "divider" ? (
                <hr className="my-3 border-line" />
              ) : block.type === "todo" ? (
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={Boolean(block.checked)}
                    disabled={readOnly}
                    onChange={() => toggleTodo(index)}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--brand)]"
                  />
                  <Input
                    value={block.content}
                    disabled={readOnly}
                    onChange={(event) => updateBlock(index, event.target.value)}
                    onBlur={handleSave}
                    placeholder="To-do item"
                    className={block.checked ? "opacity-60 line-through" : ""}
                  />
                </div>
              ) : block.type === "quote" ? (
                <Textarea
                  value={block.content}
                  disabled={readOnly}
                  onChange={(event) => updateBlock(index, event.target.value)}
                  onBlur={handleSave}
                  placeholder="Quote…"
                  className="border-l-[3px] border-l-brand italic"
                />
              ) : block.type === "code" ? (
                <Textarea
                  value={block.content}
                  disabled={readOnly}
                  onChange={(event) => updateBlock(index, event.target.value)}
                  onBlur={handleSave}
                  placeholder="Code block…"
                  className="bg-sunken font-mono text-[12.5px]"
                />
              ) : block.type === "h1" ||
                block.type === "h2" ||
                block.type === "h3" ? (
                <Input
                  value={block.content}
                  disabled={readOnly}
                  onChange={(event) => updateBlock(index, event.target.value)}
                  onBlur={handleSave}
                  placeholder={`Heading ${block.type[1]}`}
                  className={
                    block.type === "h1"
                      ? "h-auto border-transparent bg-transparent py-1 text-[21px] font-extrabold"
                      : block.type === "h2"
                        ? "h-auto border-transparent bg-transparent py-1 text-[17px] font-bold"
                        : "h-auto border-transparent bg-transparent py-1 text-[14.5px] font-bold"
                  }
                />
              ) : (
                <Textarea
                  value={block.content}
                  disabled={readOnly}
                  onChange={(event) => updateBlock(index, event.target.value)}
                  onBlur={handleSave}
                  placeholder="Type something…"
                  rows={2}
                  className="border bg-transparent focus:border-brand"
                />
              )}
            </div>

            {!readOnly ? (
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Add block below"
                  onClick={() => addBlock(index)}
                >
                  <Plus size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Remove block"
                  onClick={() => removeBlock(index)}
                >
                  <X size={13} />
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {!readOnly ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-5"
          icon={Plus}
          onClick={() => addBlock(blocks.length - 1)}
        >
          Add block
        </Button>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete document?"
          body="Deleting this doc will also soft-delete all its sub-pages. It can be restored later."
          confirmLabel="Delete doc"
          danger
          busy={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </div>
  );
}

function VersionHistoryModal({
  pageId,
  onClose,
}: {
  pageId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const versionsQuery = useQuery({
    queryKey: ["page-versions", pageId],
    queryFn: () => pagesApi.versions(pageId),
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) =>
      pagesApi.restoreVersion(pageId, versionId),
    onSuccess: (res) => {
      toast.success("Version restored");
      queryClient.setQueryData(["page", pageId], res);
      onClose();
    },
    onError: (err: Error) => toast.error("Restore failed", err.message),
  });

  const versions = versionsQuery.data?.versions ?? [];

  return (
    <Modal title="Version History" onClose={onClose}>
      {versionsQuery.isLoading ? (
        <CenterState>Loading versions…</CenterState>
      ) : null}
      <div className="max-h-[380px] space-y-2 overflow-y-auto">
        {versions.map((version: PageVersion) => (
          <div
            key={version.id || version._id}
            className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5"
          >
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-bold text-ink">
                v{version.version} — {version.title}
              </div>
              <div className="text-[11px] text-faint">
                {new Date(version.createdAt).toLocaleString()} ·{" "}
                {version.snapshotReason}
              </div>
            </div>
            <Button
              size="xs"
              loading={restoreMutation.isPending}
              onClick={() => restoreMutation.mutate(version.id || version._id)}
            >
              Restore
            </Button>
          </div>
        ))}
        {versions.length === 0 && !versionsQuery.isLoading ? (
          <p className="py-2 text-[12.5px] text-faint">
            No previous snapshots recorded.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

import { useMemo, useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FolderOpen, Trash2, UploadCloud } from "lucide-react";
import { getAccessToken, request } from "../api/client";
import {
  FileGlyph,
  FilePreview,
  FileThumbnail,
} from "../components/FilePreview";
import { fileIconFor, isPreviewable } from "../lib/filePreview";
import {
  Badge,
  Button,
  CenterState,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  SearchInput,
  Segmented,
} from "../components/ui";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

interface FileItem {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  status: string;
  s3Key: string;
  uploadedBy: string;
  createdAt: string;
}

type FilterType = "all" | "images" | "docs";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const fileIcon = fileIconFor;

export function FilesPage() {
  const { workspaceId, role } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const readOnly = role === "viewer";

  const filesQuery = useQuery({
    queryKey: ["files", workspaceId],
    queryFn: async () => {
      const res = await request<{ files: FileItem[] }>(
        `/files?workspaceId=${workspaceId}`,
      );
      return res.files ?? [];
    },
    enabled: !!workspaceId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const presignRes = await request<{
        file: { id: string };
        uploadUrl: string;
        s3Key: string;
      }>("/files/presign", {
        method: "POST",
        body: {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        },
      });

      const token = getAccessToken();
      if (presignRes.uploadUrl.startsWith("http")) {
        const put = await fetch(presignRes.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) throw new Error(`Cloud upload failed (${put.status})`);
        await request(`/files/${presignRes.file.id}/confirm`, {
          method: "POST",
          body: {},
        });
      } else {
        const raw = await fetch(`/api/v1/files/${presignRes.file.id}/raw`, {
          method: "POST",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });
        if (!raw.ok) throw new Error(`Upload failed (${raw.status})`);
      }
      return presignRes.file;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
      toast.success("File uploaded successfully");
    },
    onError: (err) => {
      toast.error("Upload failed", err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await request(`/files/${fileId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
      setPreviewFile(null);
      setDeleteTarget(null);
      toast.info("File deleted");
    },
    onError: (err) => {
      toast.error("Delete failed", err.message);
    },
  });

  const uploadFiles = (files: FileList | File[]) => {
    if (readOnly) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    for (const file of list) uploadMutation.mutate(file);
    if (list.length > 1) toast.info(`Uploading ${list.length} files…`);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (event.dataTransfer?.files?.length)
      uploadFiles(event.dataTransfer.files);
  };

  const onDragEnter = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/v1/files/${file.id}/download`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download file");
    }
  };

  const allFiles = useMemo(() => filesQuery.data ?? [], [filesQuery.data]);
  const filtered = useMemo(
    () =>
      allFiles.filter((file) => {
        if (filterType === "images" && !file.mimeType.startsWith("image/"))
          return false;
        if (
          filterType === "docs" &&
          !file.mimeType.includes("pdf") &&
          !file.mimeType.includes("text")
        )
          return false;
        if (
          search &&
          !file.fileName.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [allFiles, filterType, search],
  );

  return (
    <div
      className="mx-auto w-full"
      onDrop={onDrop}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
    >
      <PageHeader
        title="Files & Documents"
        subtitle="Uploaded workspace assets, documents, and media."
        actions={
          !readOnly ? (
            <Button
              variant="primary"
              icon={UploadCloud}
              onClick={() => inputRef.current?.click()}
              loading={uploadMutation.isPending}
            >
              Upload File
            </Button>
          ) : undefined
        }
      />

      {!readOnly ? (
        <div
          className={`mb-5 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragActive
              ? "border-brand bg-brand-soft"
              : "border-line-strong/60 bg-surface hover:border-brand/60"
          }`}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter") inputRef.current?.click();
          }}
        >
          <span
            className={`mb-1 flex h-11 w-11 items-center justify-center rounded-xl ${
              dragActive
                ? "bg-brand text-brand-ink"
                : "bg-brand-soft text-brand"
            }`}
          >
            <UploadCloud size={20} aria-hidden />
          </span>
          <div className="text-[13.5px] font-bold text-ink">
            {dragActive ? "Drop files to upload" : "Drag & drop files here"}
          </div>
          <div className="text-[12px] text-faint">
            or click to browse — uploads stream securely to workspace storage
          </div>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) uploadFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter files by name…"
          className="w-full sm:w-[240px]"
        />
        <Segmented<FilterType>
          value={filterType}
          onChange={setFilterType}
          options={[
            { value: "all", label: "All" },
            { value: "images", label: "Images" },
            { value: "docs", label: "Docs" },
          ]}
        />
        <span className="ml-auto text-[12px] text-faint">
          {filtered.length} of {allFiles.length} files
        </span>
      </div>

      {filesQuery.isLoading ? (
        <CenterState>Loading files…</CenterState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No files found"
          hint={
            allFiles.length === 0
              ? "No files have been uploaded to this workspace yet."
              : "No files matched your filter criteria."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((file) => {
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setPreviewFile(file)}
                className="cursor-pointer rounded-xl border border-line bg-surface p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md"
              >
                <div className="flex items-center gap-2.5">
                  {isPreviewable(file.mimeType) ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <FileGlyph mimeType={file.mimeType} />
                    </span>
                  ) : (
                    <FileThumbnail file={file} />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-ink">
                    {file.fileName}
                  </span>
                </div>
                {isPreviewable(file.mimeType) ? (
                  <div className="mt-3">
                    <FilePreview file={file} height="h-32" compact />
                  </div>
                ) : null}
                <div className="mt-3 flex items-center justify-between text-[11px] text-faint">
                  <span>{formatSize(file.size)}</span>
                  <Badge tone={file.status === "ready" ? "success" : "warning"}>
                    {file.status}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {previewFile ? (
        <Modal
          title={
            <span className="flex items-center gap-2">
              {(() => {
                const Icon = fileIcon(previewFile.mimeType);
                return <Icon size={15} className="text-brand" aria-hidden />;
              })()}
              {previewFile.fileName}
            </span>
          }
          onClose={() => setPreviewFile(null)}
          size="sm"
          footer={
            <>
              {!readOnly ? (
                <Button
                  variant="danger"
                  icon={Trash2}
                  onClick={() => setDeleteTarget(previewFile)}
                >
                  Delete
                </Button>
              ) : null}
              <Button
                variant="primary"
                icon={Download}
                onClick={() => void handleDownload(previewFile)}
              >
                Download
              </Button>
            </>
          }
        >
          <div className="mb-4">
            <FilePreview file={previewFile} height="h-72" />
          </div>
          <dl className="space-y-2 text-[12.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-faint">MIME type</dt>
              <dd className="font-mono text-[11.5px] text-muted">
                {previewFile.mimeType}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-faint">Size</dt>
              <dd className="font-semibold text-ink">
                {formatSize(previewFile.size)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-faint">Status</dt>
              <dd>
                <Badge
                  tone={previewFile.status === "ready" ? "success" : "warning"}
                >
                  {previewFile.status}
                </Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-faint">Uploaded</dt>
              <dd className="text-muted">
                {new Date(previewFile.createdAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title={`Delete ${deleteTarget.fileName}?`}
          body={
            <div className="space-y-3">
              <FilePreview file={deleteTarget} height="h-48" compact />
              <p className="text-[12.5px] text-muted">
                This removes the file from the workspace and deletes its stored
                contents. This action cannot be undone.
              </p>
            </div>
          }
          confirmLabel="Delete file"
          danger
          busy={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}

      {dragActive ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center">
          <span className="flex items-center gap-2 rounded-full bg-sidebar px-4 py-2 text-[12.5px] font-bold text-sidebar-strong shadow-lg">
            <UploadCloud size={14} className="text-brand" aria-hidden />
            Release to upload to {readOnly ? "workspace" : "this workspace"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

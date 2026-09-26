import { useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, Download, Trash2, X, FileText } from "lucide-react";
import { request, getAccessToken } from "../api/client";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";
import { Badge, CenterState, EmptyState, Spinner } from "../components/ui";

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

export function FilesPage() {
  const { workspaceId, role } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const readOnly = role === "viewer";

  const filesQuery = useQuery({
    queryKey: ["files", workspaceId],
    queryFn: async () => {
      try {
        const res = await request<{ files: FileItem[] }>(
          `/files?workspaceId=${workspaceId}`,
        );
        return res.files ?? [];
      } catch {
        return [];
      }
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

      try {
        const uploadTarget = presignRes.uploadUrl.startsWith("http")
          ? presignRes.uploadUrl
          : `/api/v1/files/${presignRes.file.id}/raw`;

        const token = getAccessToken();
        await fetch(uploadTarget, {
          method: "POST",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });
      } catch {
        await request(`/files/${presignRes.file.id}/confirm`, {
          method: "POST",
          body: {},
        });
      }

      return presignRes.file;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
      toast.success("File uploaded successfully");
    },
    onError: (err) => {
      toast.error(`Upload failed: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await request(`/files/${fileId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
      setPreviewFile(null);
      toast.info("File deleted");
    },
    onError: (err) => {
      toast.error(`Delete failed: ${err.message}`);
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      uploadMutation.mutate(files[i]);
    }
    e.target.value = "";
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/v1/files/${file.id}/download`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (!res.ok) {
        throw new Error("Download failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download file directly");
    }
  };

  const allFiles = filesQuery.data ?? [];
  const filtered = allFiles.filter((f) => {
    if (filterType !== "all") {
      if (filterType === "images" && !f.mimeType.startsWith("image/"))
        return false;
      if (
        filterType === "docs" &&
        !f.mimeType.includes("pdf") &&
        !f.mimeType.includes("text")
      )
        return false;
    }
    if (search && !f.fileName.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="files-page page-container">
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 className="page-title">Files & Documents</h1>
          <p className="page-description">
            Uploaded workspace assets, documents, and media.
          </p>
        </div>
        {!readOnly && (
          <label
            className="btn btn--primary"
            style={{
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <UploadCloud size={16} /> Upload File
            <input
              type="file"
              style={{ display: "none" }}
              onChange={handleFileChange}
              disabled={uploadMutation.isPending}
            />
          </label>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Filter files by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
          style={{
            width: 240,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "images", "docs"].map((ft) => (
            <button
              key={ft}
              className={`btn btn--sm ${filterType === ft ? "btn--accent" : "btn--ghost"}`}
              onClick={() => setFilterType(ft)}
              style={{ textTransform: "capitalize" }}
            >
              {ft}
            </button>
          ))}
        </div>
      </div>

      {filesQuery.isLoading && (
        <CenterState>
          <Spinner large />
        </CenterState>
      )}

      {filesQuery.isSuccess && filtered.length === 0 && (
        <EmptyState
          icon="📁"
          title="No files found"
          hint={
            allFiles.length === 0
              ? "No files have been uploaded to this workspace yet."
              : "No files matched your filter criteria."
          }
        />
      )}

      {filesQuery.isSuccess && filtered.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((file) => (
            <div
              key={file.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 14,
                backgroundColor: "var(--card-bg, #ffffff)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                cursor: "pointer",
              }}
              onClick={() => setPreviewFile(file)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={20} color="var(--accent, #f97316)" />
                <span
                  style={{
                    fontWeight: 500,
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {file.fileName}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                <span>{(file.size / 1024).toFixed(1)} KB</span>
                <Badge tone={file.status === "ready" ? "success" : "warning"}>
                  {file.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewFile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setPreviewFile(null)}
        >
          <div
            style={{
              backgroundColor: "var(--bg, #fff)",
              padding: 24,
              borderRadius: 8,
              minWidth: 320,
              maxWidth: 480,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16 }}>
                {previewFile.fileName}
              </h3>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setPreviewFile(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div
              style={{
                fontSize: 13,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <div>
                <strong>MIME Type:</strong> {previewFile.mimeType}
              </div>
              <div>
                <strong>Size:</strong> {(previewFile.size / 1024).toFixed(1)} KB
              </div>
              <div>
                <strong>Status:</strong> {previewFile.status}
              </div>
            </div>
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => handleDownload(previewFile)}
              >
                <Download size={14} style={{ marginRight: 4 }} /> Download
              </button>
              {!readOnly && (
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => deleteMutation.mutate(previewFile.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={14} style={{ marginRight: 4 }} /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

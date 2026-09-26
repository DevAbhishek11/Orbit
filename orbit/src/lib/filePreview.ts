import { useEffect, useState } from "react";
import {
  File as FileIcon,
  FileArchive,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
} from "lucide-react";
import { fetchBlob } from "../api/client";

export interface PreviewableFile {
  id: string;
  fileName: string;
  mimeType: string;
  size?: number;
  status?: string;
}

export type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "none";

export function previewKind(mimeType: string): PreviewKind {
  const type = (mimeType || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (
    type.startsWith("text/") ||
    type === "application/json" ||
    type === "application/xml"
  ) {
    return "text";
  }
  return "none";
}

export function isPreviewable(mimeType: string): boolean {
  return previewKind(mimeType) !== "none";
}

export function fileIconFor(mimeType: string) {
  const kind = previewKind(mimeType);
  if (kind === "image") return ImageIcon;
  if (kind === "video") return Video;
  if (kind === "audio") return Music;
  if (kind === "pdf" || kind === "text") return FileText;
  if (mimeType.includes("zip") || mimeType.includes("compressed"))
    return FileArchive;
  return FileIcon;
}

export type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string; text?: string }
  | { status: "error"; message: string };

export function useFileObjectUrl(
  file: PreviewableFile | null,
  enabled = true,
): LoadState {
  const key = file && enabled && isPreviewable(file.mimeType) ? file.id : null;
  const [state, setState] = useState<{ key: string | null; value: LoadState }>({
    key: null,
    value: { status: "idle" },
  });

  useEffect(() => {
    if (!key || !file) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const blob = await fetchBlob(
          `/files/${file.id}/download?disposition=inline`,
        );
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        if (previewKind(file.mimeType) === "text") {
          const text = (await blob.text()).slice(0, 20_000);
          if (cancelled) return;
          setState({ key, value: { status: "ready", url: objectUrl, text } });
          return;
        }
        setState({ key, value: { status: "ready", url: objectUrl } });
      } catch (err) {
        if (cancelled) return;
        setState({
          key,
          value: {
            status: "error",
            message:
              err instanceof Error ? err.message : "Could not load preview",
          },
        });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return { status: "idle" };
  return state.key === key ? state.value : { status: "loading" };
}

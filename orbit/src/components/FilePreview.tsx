import {
  File as FileIcon,
  FileArchive,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
} from "lucide-react";
import {
  previewKind,
  useFileObjectUrl,
  type PreviewableFile,
} from "../lib/filePreview";

export function FileGlyph({
  mimeType,
  size = 16,
  className,
}: {
  mimeType: string;
  size?: number;
  className?: string;
}) {
  const kind = previewKind(mimeType);
  if (kind === "image")
    return <ImageIcon size={size} className={className} aria-hidden />;
  if (kind === "video")
    return <Video size={size} className={className} aria-hidden />;
  if (kind === "audio")
    return <Music size={size} className={className} aria-hidden />;
  if (kind === "pdf" || kind === "text")
    return <FileText size={size} className={className} aria-hidden />;
  if (mimeType.includes("zip") || mimeType.includes("compressed"))
    return <FileArchive size={size} className={className} aria-hidden />;
  return <FileIcon size={size} className={className} aria-hidden />;
}

function PreviewFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-lg border border-line bg-sunken ${className}`}
    >
      {children}
    </div>
  );
}

export function FilePreview({
  file,
  height = "h-64",
  compact = false,
}: {
  file: PreviewableFile;
  height?: string;
  compact?: boolean;
}) {
  const kind = previewKind(file.mimeType);
  const state = useFileObjectUrl(file, kind !== "none");

  if (kind === "none") {
    return (
      <PreviewFrame className={`${height} w-full flex-col gap-2`}>
        <FileGlyph
          mimeType={file.mimeType}
          size={compact ? 20 : 28}
          className="text-faint"
        />
        <span className="px-3 text-center text-[11.5px] text-faint">
          No inline preview for {file.mimeType || "this file type"}
        </span>
      </PreviewFrame>
    );
  }

  if (state.status === "loading" || state.status === "idle") {
    return (
      <PreviewFrame className={`${height} w-full`}>
        <span className="text-[12px] text-faint">Loading preview…</span>
      </PreviewFrame>
    );
  }

  if (state.status === "error") {
    return (
      <PreviewFrame className={`${height} w-full flex-col gap-2`}>
        <FileGlyph mimeType={file.mimeType} size={22} className="text-faint" />
        <span className="px-3 text-center text-[11.5px] text-danger">
          {state.message}
        </span>
      </PreviewFrame>
    );
  }

  if (kind === "image") {
    return (
      <PreviewFrame className={`${height} w-full`}>
        <img
          src={state.url}
          alt={file.fileName}
          className="max-h-full max-w-full object-contain"
        />
      </PreviewFrame>
    );
  }

  if (kind === "pdf") {
    return (
      <PreviewFrame className={`${height} w-full`}>
        <iframe
          src={state.url}
          title={file.fileName}
          className="h-full w-full"
        />
      </PreviewFrame>
    );
  }

  if (kind === "video") {
    return (
      <PreviewFrame className={`${height} w-full`}>
        <video src={state.url} controls className="max-h-full max-w-full">
          <track kind="captions" />
        </video>
      </PreviewFrame>
    );
  }

  if (kind === "audio") {
    return (
      <PreviewFrame className="w-full p-3">
        <audio src={state.url} controls className="w-full" />
      </PreviewFrame>
    );
  }

  return (
    <PreviewFrame className={`${height} w-full items-start`}>
      <pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words p-3 text-left font-mono text-[11.5px] leading-relaxed text-muted">
        {state.text}
      </pre>
    </PreviewFrame>
  );
}

export function FileThumbnail({
  file,
  className = "h-9 w-9",
}: {
  file: PreviewableFile;
  className?: string;
}) {
  const isImage = previewKind(file.mimeType) === "image";
  const state = useFileObjectUrl(file, isImage);

  if (isImage && state.status === "ready") {
    return (
      <img
        src={state.url}
        alt={file.fileName}
        className={`${className} shrink-0 rounded-lg object-cover`}
      />
    );
  }

  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand`}
    >
      <FileGlyph mimeType={file.mimeType} size={16} />
    </span>
  );
}

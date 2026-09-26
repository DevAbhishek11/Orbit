import { describe, expect, it } from "vitest";
import { fileIconFor, isPreviewable, previewKind } from "../lib/filePreview";

describe("previewKind", () => {
  it("detects browser-renderable media", () => {
    expect(previewKind("image/png")).toBe("image");
    expect(previewKind("image/svg+xml")).toBe("image");
    expect(previewKind("application/pdf")).toBe("pdf");
    expect(previewKind("video/mp4")).toBe("video");
    expect(previewKind("audio/mpeg")).toBe("audio");
    expect(previewKind("text/markdown")).toBe("text");
    expect(previewKind("application/json")).toBe("text");
  });

  it("falls back for binaries and unknown types", () => {
    expect(previewKind("application/zip")).toBe("none");
    expect(previewKind("application/octet-stream")).toBe("none");
    expect(previewKind("")).toBe("none");
  });

  it("is case insensitive", () => {
    expect(previewKind("IMAGE/PNG")).toBe("image");
    expect(previewKind("Application/PDF")).toBe("pdf");
  });

  it("exposes a matching isPreviewable helper", () => {
    expect(isPreviewable("image/webp")).toBe(true);
    expect(isPreviewable("application/zip")).toBe(false);
  });

  it("always resolves an icon", () => {
    for (const mime of [
      "image/png",
      "video/mp4",
      "audio/mpeg",
      "application/pdf",
      "application/zip",
      "application/octet-stream",
    ]) {
      expect(fileIconFor(mime)).toBeTruthy();
    }
  });
});

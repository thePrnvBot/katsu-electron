/** Tests for preview type classification. */

import { describe, expect, it } from "vitest";

import { getPreviewType } from "./file-preview";

describe("getPreviewType", () => {
  it("classifies markdown by extension and MIME type", () => {
    expect(getPreviewType("", "README.md")).toBe("markdown");
    expect(getPreviewType("text/markdown", "notes.markdown")).toBe("markdown");
  });

  it("classifies media by extension", () => {
    expect(getPreviewType("", "photo.png")).toBe("image");
    expect(getPreviewType("", "clip.mp4")).toBe("video");
    expect(getPreviewType("", "song.mp3")).toBe("audio");
    expect(getPreviewType("", "doc.pdf")).toBe("pdf");
  });

  it("classifies plain text and unknown files", () => {
    expect(getPreviewType("text/plain", "notes.txt")).toBe("text");
    expect(getPreviewType("", "archive.zip")).toBe("download");
  });

  it("prefers MIME type over name", () => {
    expect(getPreviewType("image/jpeg", "without-extension")).toBe("image");
  });
});

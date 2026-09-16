/** Classifies dropped and staged files and builds preview URLs. */

import { MAX_TEMP_FILE_BYTES } from "../../shared/contract";
import type { PreviewType } from "../../shared/contract";
import { PREVIEW_TYPE_BY_EXTENSION } from "../../shared/file-types";
import { ignoreFailure } from "./ignore-failure";

const TEXT_MIME_PREFIXES = [
  "text/",
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/xml",
  "application/x-yaml",
  "application/toml",
];

export interface FilePreviewResult {
  fileName: string;
  previewType: PreviewType;
  url: string;
}

/** Classify a file from its MIME type and name into a preview kind. */
export const getPreviewType = (
  mimeType: string,
  fileName: string
): PreviewType => {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  if (mimeType === "application/pdf") {
    return "pdf";
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const byExtension = PREVIEW_TYPE_BY_EXTENSION.get(ext);
  if (byExtension !== undefined) {
    return byExtension;
  }
  if (mimeType === "text/markdown") {
    return "markdown";
  }
  if (TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
    return "text";
  }

  return "download";
};

const KATSU_PREVIEW_HOST = "preview";

const buildKatsuUrl = (filePath: string): string =>
  `katsu://${KATSU_PREVIEW_HOST}/${encodeURIComponent(filePath)}`;

/** Inverse of buildKatsuUrl; null for any non-preview URL. */
const tempPathFromKatsuUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "katsu:" || parsed.host !== KATSU_PREVIEW_HOST) {
      return null;
    }
    return decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    return null;
  }
};

/**
 * Release the resources behind a preview URL: blob URLs are revoked,
 * katsu:// temp files are deleted in the main process.
 */
export const revokePreviewUrl = (url: string): void => {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
    return;
  }
  const tempPath = tempPathFromKatsuUrl(url);
  if (tempPath) {
    void ignoreFailure(window.electronAPI.deleteTempFile(tempPath));
  }
};

/**
 * Drag-and-drop path: text stays an in-memory blob; everything else is
 * uploaded once to the drops dir and served via katsu://. Media dimensions
 * are reported later by the preview components themselves (single load).
 */
export const createFilePreview = async (
  file: File
): Promise<FilePreviewResult> => {
  if (file.size > MAX_TEMP_FILE_BYTES) {
    throw new Error("File exceeds maximum allowed size");
  }

  const fileName = file.name;
  const mimeType = file.type || "application/octet-stream";
  const previewType = getPreviewType(mimeType, fileName);

  if (previewType === "text") {
    return {
      fileName,
      previewType,
      url: URL.createObjectURL(file),
    };
  }

  const buffer = await file.arrayBuffer();
  const rawPath = await window.electronAPI.saveTempFile(fileName, buffer);
  return {
    fileName,
    previewType,
    url: buildKatsuUrl(rawPath),
  };
};

/**
 * Native-dialog path: the file was already copied into the drops dir by the
 * main process (`fs:stageFile`) — zero bytes cross the IPC bridge.
 */
export const createFilePreviewFromPath = (
  name: string,
  stagedPath: string
): FilePreviewResult => ({
  fileName: name,
  previewType: getPreviewType("", name),
  url: buildKatsuUrl(stagedPath),
});

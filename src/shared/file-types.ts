/**
 * Shared file-extension tables: single source for preview classification,
 * MIME mapping, and the per-family extension lists. Imported by both the
 * Electron main process and the renderer — keep it dependency-free.
 */

import type { PreviewType } from "./contract.js";

export const HTML_FILE_EXTENSIONS = ["html", "htm"] as const;
export const MARKDOWN_FILE_EXTENSIONS = ["md", "markdown"] as const;
export const IMAGE_FILE_EXTENSIONS = [
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
] as const;
export const VIDEO_FILE_EXTENSIONS = [
  "mp4",
  "webm",
  "ogg",
  "mov",
  "mkv",
  "avi",
] as const;
export const AUDIO_FILE_EXTENSIONS = [
  "mp3",
  "wav",
  "ogg",
  "aac",
  "flac",
  "m4a",
  "wma",
] as const;
export const PDF_FILE_EXTENSIONS = ["pdf"] as const;
export const TEXT_FILE_EXTENSIONS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "css",
  "html",
  "htm",
  "xml",
  "svg",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "env",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "bat",
  "cmd",
  "sql",
  "graphql",
  "gql",
  "txt",
  "log",
  "csv",
  "tsv",
] as const;

/** Lookup from a lowercase extension (no dot) to its preview surface.
 * The plain-text list goes first so the specific media lists below win for
 * extensions that appear in both (html, htm, svg, xml). */
export const PREVIEW_TYPE_BY_EXTENSION: ReadonlyMap<string, PreviewType> =
  new Map([
    ...TEXT_FILE_EXTENSIONS.map((extension) => [extension, "text"] as const),
    ...IMAGE_FILE_EXTENSIONS.map(
      (extension) => [extension, "image"] as const
    ),
    ...VIDEO_FILE_EXTENSIONS.map((extension) => [extension, "video"] as const),
    ...AUDIO_FILE_EXTENSIONS.map((extension) => [extension, "audio"] as const),
    ...PDF_FILE_EXTENSIONS.map((extension) => [extension, "pdf"] as const),
    ...HTML_FILE_EXTENSIONS.map((extension) => [extension, "html"] as const),
    ...MARKDOWN_FILE_EXTENSIONS.map(
      (extension) => [extension, "markdown"] as const
    ),
  ]);

/** MIME types for the katsu:// protocol, keyed by dotted lowercase extension. */
export const MIME_BY_EXTENSION: ReadonlyMap<string, string> = new Map([
  [".aac", "audio/aac"],
  [".avi", "video/x-msvideo"],
  [".bmp", "image/bmp"],
  [".css", "text/css"],
  [".flac", "audio/flac"],
  [".gif", "image/gif"],
  [".go", "text/x-go"],
  [".htm", "text/html"],
  [".html", "text/html"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".jsx", "text/javascript"],
  [".katsu-html", "text/html"],
  [".m4a", "audio/mp4"],
  [".md", "text/markdown"],
  [".mkv", "video/x-matroska"],
  [".mov", "video/quicktime"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".ogg", "audio/ogg"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".py", "text/x-python"],
  [".rs", "text/x-rust"],
  [".svg", "image/svg+xml"],
  [".ts", "text/typescript"],
  [".tsx", "text/typescript"],
  [".txt", "text/plain"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
]);

/** MIME type for a file path, defaulting to a safe octet stream. */
export const getMimeType = (filePath: string): string => {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) {
    return "application/octet-stream";
  }
  const extension = filePath.slice(dotIndex).toLowerCase();
  return MIME_BY_EXTENSION.get(extension) ?? "application/octet-stream";
};

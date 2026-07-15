import {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from "../lib/constants";

const TEXT_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "md",
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
]);

const TEXT_MIME_PREFIXES = [
  "text/",
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/xml",
  "application/x-yaml",
  "application/toml",
];

export type PreviewType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "download";

export interface FilePreviewResult {
  fileName: string;
  nativeHeight?: number;
  nativeWidth?: number;
  previewType: PreviewType;
  url: string;
}

export const getPreviewType = (
  mimeType: string,
  fileName: string
): PreviewType => {
  if (mimeType.startsWith("image/") || mimeType === "image/svg+xml") {
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

  if (IMAGE_EXTENSIONS.has(ext)) {
    return "image";
  }
  if (VIDEO_EXTENSIONS.has(ext)) {
    return "video";
  }
  if (AUDIO_EXTENSIONS.has(ext)) {
    return "audio";
  }
  if (ext === "pdf") {
    return "pdf";
  }
  if (
    TEXT_EXTENSIONS.has(ext) ||
    TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p))
  ) {
    return "text";
  }

  return "download";
};

const getImageDimensions = (url: string): Promise<{ w: number; h: number }> =>
  new Promise((resolve) => {
    const img = new Image();
    img.addEventListener(
      "load",
      () => resolve({ h: img.naturalHeight, w: img.naturalWidth }),
      { once: true }
    );
    img.addEventListener("error", () => resolve({ h: 0, w: 0 }), {
      once: true,
    });
    img.src = url;
  });

const getVideoDimensions = (url: string): Promise<{ w: number; h: number }> =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    video.addEventListener(
      "loadedmetadata",
      () => resolve({ h: video.videoHeight, w: video.videoWidth }),
      { once: true }
    );
    video.addEventListener("error", () => resolve({ h: 0, w: 0 }), {
      once: true,
    });
    video.src = url;
  });

const saveRawToTemp = async (name: string, file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  return window.electronAPI.saveTempFile(name, buffer);
};

export const createFilePreview = async (
  file: File
): Promise<FilePreviewResult> => {
  const fileName = file.name;
  const mimeType = file.type || "application/octet-stream";
  const previewType = getPreviewType(mimeType, fileName);

  if (previewType === "image" || previewType === "video") {
    const probeUrl = URL.createObjectURL(file);
    const getDims =
      previewType === "image" ? getImageDimensions : getVideoDimensions;
    const { w, h } = await getDims(probeUrl);
    URL.revokeObjectURL(probeUrl);

    const rawPath = await saveRawToTemp(fileName, file);
    const rawUrl = `katsu://preview/${encodeURIComponent(rawPath)}?raw`;

    return {
      fileName,
      nativeHeight: h || undefined,
      nativeWidth: w || undefined,
      previewType,
      url: rawUrl,
    };
  }

  const rawPath = await saveRawToTemp(fileName, file);
  const rawUrl = `katsu://preview/${encodeURIComponent(rawPath)}?raw`;

  return {
    fileName,
    previewType,
    url: rawUrl,
  };
};

export const revokeBlobUrl = (url: string): void => {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
};

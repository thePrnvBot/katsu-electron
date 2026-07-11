import * as Effect from "effect/Effect";

const WRAP_EXTENSIONS = new Set([
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

const WRAP_MIME_PREFIXES = [
  "text/",
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/xml",
  "application/x-yaml",
  "application/toml",
];

const shouldWrap = (mimeType: string, fileName: string): boolean => {
  if (WRAP_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
    return true;
  }
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return WRAP_EXTENSIONS.has(ext);
};

const escapeHtml = (str: string): string =>
  str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const getTextWrapHtml = (content: string, fileName: string): string => {
  const lang = fileName.split(".").pop() ?? "text";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(fileName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f0f0f;
    color: #d4d4d4;
    font-family: 'Geist Mono', 'Fira Code', monospace;
    font-size: 13px;
    line-height: 1.6;
    padding: 16px;
    overflow: auto;
  }
  .filename {
    color: #666;
    font-size: 11px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #222;
  }
  pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    tab-size: 2;
  }
</style>
</head>
<body>
<div class="filename">${escapeHtml(fileName)} — ${lang}</div>
<pre>${escapeHtml(content)}</pre>
</body>
</html>`;
};

const getDownloadHtml = (fileName: string): string =>
  `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(fileName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f0f0f;
    color: #999;
    font-family: system-ui, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    flex-direction: column;
    gap: 12px;
  }
  .icon { font-size: 32px; opacity: 0.4; }
  .name { color: #ddd; font-size: 14px; }
  .hint { font-size: 12px; }
</style>
</head>
<body>
<div class="icon">&#128230;</div>
<div class="name">${escapeHtml(fileName)}</div>
<div class="hint">Preview not available — download to view</div>
</body>
</html>`;

const getImageWrapHtml = (dataUrl: string, fileName: string): string =>
  `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(fileName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #0f0f0f; }
  img { width: 100%; height: 100%; object-fit: contain; display: block; }
</style>
</head>
<body>
<img src="${dataUrl}" alt="${escapeHtml(fileName)}" onload="if(window.katsuWebview)katsuWebview.postMessage({type:'media-dimensions',w:this.naturalWidth,h:this.naturalHeight})">
</body>
</html>`;

const getVideoWrapHtml = (rawUrl: string, fileName: string): string =>
  `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(fileName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #0f0f0f; }
  video { width: 100%; height: 100%; object-fit: contain; display: block; }
</style>
</head>
<body>
<video src="${rawUrl}" controls autoplay onloadedmetadata="if(window.katsuWebview)katsuWebview.postMessage({type:'media-dimensions',w:this.videoWidth,h:this.videoHeight})"></video>
</body>
</html>`;

const getAudioWrapHtml = (rawUrl: string, fileName: string): string =>
  `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(fileName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f0f0f;
    color: #999;
    font-family: system-ui, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    flex-direction: column;
    gap: 16px;
  }
  .name { color: #ddd; font-size: 14px; }
</style>
</head>
<body>
<div class="name">${escapeHtml(fileName)}</div>
<audio src="${rawUrl}" controls autoplay style="width: 80%;"></audio>
</body>
</html>`;

export interface FilePreviewResult {
  url: string;
  fileName: string;
  nativeWidth?: number;
  nativeHeight?: number;
}

const getImageDimensions = (url: string): Promise<{ w: number; h: number }> =>
  Effect.runPromise(
    Effect.async<{ w: number; h: number }, never>((resolve) => {
      const img = new Image();
      img.addEventListener(
        "load",
        () =>
          resolve(
            Effect.succeed({ h: img.naturalHeight, w: img.naturalWidth })
          ),
        { once: true }
      );
      img.addEventListener(
        "error",
        () => resolve(Effect.succeed({ h: 0, w: 0 })),
        { once: true }
      );
      img.src = url;
    })
  );

const fileToDataUrl = (file: File): Promise<string> =>
  Effect.runPromise(
    Effect.async<string, never>((resolve) => {
      const reader = new FileReader();
      reader.addEventListener(
        "load",
        () => resolve(Effect.succeed(reader.result as string)),
        { once: true }
      );
      reader.addEventListener("error", () => resolve(Effect.succeed("")), {
        once: true,
      });
      reader.readAsDataURL(file);
    })
  );

const getVideoDimensions = (url: string): Promise<{ w: number; h: number }> =>
  Effect.runPromise(
    Effect.async<{ w: number; h: number }, never>((resolve) => {
      const video = document.createElement("video");
      video.addEventListener(
        "loadedmetadata",
        () =>
          resolve(
            Effect.succeed({ h: video.videoHeight, w: video.videoWidth })
          ),
        { once: true }
      );
      video.addEventListener(
        "error",
        () => resolve(Effect.succeed({ h: 0, w: 0 })),
        { once: true }
      );
      video.src = url;
    })
  );

const saveHtmlToTemp = (name: string, html: string): Promise<string> => {
  const { buffer } = new TextEncoder().encode(html);
  const rawName = `${name.replace(/\.[^.]+$/u, "")}.katsu-html`;
  return window.electronAPI.saveTempFile(rawName, buffer);
};

const saveRawToTemp = async (name: string, file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  return window.electronAPI.saveTempFile(name, buffer);
};

export const createFilePreview = async (
  file: File
): Promise<FilePreviewResult> => {
  const fileName = file.name;
  const mimeType = file.type || "application/octet-stream";

  if (shouldWrap(mimeType, fileName)) {
    const text = await file.text();
    const html = getTextWrapHtml(text, fileName);
    const filePath = await saveHtmlToTemp(fileName, html);
    return {
      fileName,
      url: `katsu://preview/${encodeURIComponent(filePath)}?raw`,
    };
  }

  if (mimeType.startsWith("image/") || mimeType === "image/svg+xml") {
    const dataUrl = await fileToDataUrl(file);
    const { w, h } = await getImageDimensions(dataUrl);
    const html = getImageWrapHtml(dataUrl, fileName);
    const filePath = await saveHtmlToTemp(fileName, html);
    return {
      fileName,
      nativeHeight: h || undefined,
      nativeWidth: w || undefined,
      url: `katsu://preview/${encodeURIComponent(filePath)}?raw`,
    };
  }

  if (mimeType.startsWith("video/")) {
    const probeUrl = URL.createObjectURL(file);
    const { w, h } = await getVideoDimensions(probeUrl);
    URL.revokeObjectURL(probeUrl);

    const rawPath = await saveRawToTemp(fileName, file);
    const rawUrl = `katsu://preview/${encodeURIComponent(rawPath)}?raw`;
    const html = getVideoWrapHtml(rawUrl, fileName);
    const htmlPath = await saveHtmlToTemp(fileName, html);
    return {
      fileName,
      nativeHeight: h || undefined,
      nativeWidth: w || undefined,
      url: `katsu://preview/${encodeURIComponent(htmlPath)}?raw`,
    };
  }

  if (mimeType.startsWith("audio/")) {
    const rawPath = await saveRawToTemp(fileName, file);
    const rawUrl = `katsu://preview/${encodeURIComponent(rawPath)}?raw`;
    const html = getAudioWrapHtml(rawUrl, fileName);
    const htmlPath = await saveHtmlToTemp(fileName, html);
    return {
      fileName,
      url: `katsu://preview/${encodeURIComponent(htmlPath)}?raw`,
    };
  }

  if (mimeType === "application/pdf") {
    const filePath = await saveRawToTemp(fileName, file);
    return {
      fileName,
      url: `katsu://preview/${encodeURIComponent(filePath)}?raw`,
    };
  }

  const html = getDownloadHtml(fileName);
  const filePath = await saveHtmlToTemp(fileName, html);
  return {
    fileName,
    url: `katsu://preview/${encodeURIComponent(filePath)}?raw`,
  };
};

export const revokeBlobUrl = (url: string): void => {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
};

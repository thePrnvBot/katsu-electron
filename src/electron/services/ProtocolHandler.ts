import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import { ProtocolError } from "../shared/types.js";
import fs from "node:fs/promises";
import path from "node:path";

export interface ProtocolHandler {
  readonly handleRequest: (url: string) => Effect.Effect<Response, ProtocolError>;
  readonly generateTextPreview: (
    content: string,
    filename: string
  ) => Effect.Effect<string, ProtocolError>;
  readonly generateErrorPage: (
    error: Error,
    url: string
  ) => Effect.Effect<string, ProtocolError>;
  readonly clearCache: Effect.Effect<void>;
  readonly getCacheSize: Effect.Effect<number>;
}

export const ProtocolHandler = Context.GenericTag<ProtocolHandler>("ProtocolHandler");

const MIME_TYPES: Record<string, string> = {
  ".txt": "text/plain",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".md": "text/markdown",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".jsx": "text/javascript",
  ".py": "text/x-python",
  ".rs": "text/x-rust",
  ".go": "text/x-go",
  ".katsu-html": "text/html",
};

function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

function isTextMimeType(mimeType: string): boolean {
  return mimeType.startsWith("text/") || mimeType === "application/json";
}

function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

function isAudioMimeType(mimeType: string): boolean {
  return mimeType.startsWith("audio/");
}

function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const cache = new Map<string, string>();

function generateTextPreviewHtml(content: string, filename: string): string {
  const lang = filename.split(".").pop() ?? "text";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${escapeHtml(filename)}</title>
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
<div class="filename">${escapeHtml(filename)} — ${escapeHtml(lang)}</div>
<pre>${escapeHtml(content)}</pre>
</body>
</html>`;
}

function generateImagePreviewHtml(filename: string, rawUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src katsu: data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>${escapeHtml(filename)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0a0a; }
  img { width: 100%; height: 100%; object-fit: contain; display: block; }
</style>
</head>
<body>
<img src="${escapeHtml(rawUrl)}" alt="${escapeHtml(filename)}" onload="if(window.katsuWebview)katsuWebview.postMessage({type:'media-dimensions',w:this.naturalWidth,h:this.naturalHeight})">
</body>
</html>`;
}

function generateVideoPreviewHtml(filename: string, rawUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src katsu: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>${escapeHtml(filename)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0a0a; }
  video { width: 100%; height: 100%; object-fit: contain; display: block; }
</style>
</head>
<body>
<video src="${escapeHtml(rawUrl)}" controls autoplay onloadedmetadata="if(window.katsuWebview)katsuWebview.postMessage({type:'media-dimensions',w:this.videoWidth,h:this.videoHeight})"></video>
</body>
</html>`;
}

function generateAudioPreviewHtml(filename: string, rawUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src katsu: blob:; style-src 'unsafe-inline'">
<title>${escapeHtml(filename)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0a0a; }
  body { display: flex; align-items: center; justify-content: center; }
  audio { width: 80%; max-width: 500px; }
</style>
</head>
<body>
<audio src="${escapeHtml(rawUrl)}" controls autoplay></audio>
</body>
</html>`;
}

function generateErrorPageHtml(error: Error, url: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Error</title>
<style>
  body { margin: 0; padding: 16px; background: #1a1a1a; color: #ff6b6b; font-family: system-ui; }
  h2 { color: #ff6b6b; }
  p { color: #888; }
</style>
</head>
<body>
  <h2>Failed to load</h2>
  <p>${escapeHtml(url)}</p>
  <p>${escapeHtml(error.message)}</p>
</body>
</html>`;
}

function validateFilePath(filePath: string): Effect.Effect<string, ProtocolError> {
  return Effect.gen(function* () {
    if (!path.isAbsolute(filePath)) {
      return yield* Effect.fail(
        new ProtocolError("InvalidPath", filePath)
      );
    }

    const resolved = path.resolve(filePath);

    const stat = yield* Effect.tryPromise({
      try: () => fs.stat(resolved),
      catch: () => new ProtocolError("FileNotFound", filePath),
    });

    if (!stat.isFile()) {
      return yield* Effect.fail(
        new ProtocolError("InvalidPath", filePath)
      );
    }

    return resolved;
  });
}

export const ProtocolHandlerLive = Layer.succeed(ProtocolHandler, {
  handleRequest: (url: string) =>
    Effect.gen(function* () {
      const parsedUrl = new URL(url);
      const isRaw = parsedUrl.searchParams.has("raw");
      const rawUrl = `${url}${url.includes("?") ? "&" : "?"}raw`;

      // katsu://preview/<path> → host="preview", pathname="/<path>"
      const filePath = decodeURIComponent(parsedUrl.pathname.slice(1));

      const validatedPath = yield* validateFilePath(filePath);

      if (isRaw) {
        const content = yield* Effect.tryPromise({
          try: () => fs.readFile(validatedPath),
          catch: (err) => new ProtocolError("FileNotFound", validatedPath, err),
        });

        const mimeType = getMimeType(validatedPath);
        const arrayBuffer = content.buffer.slice(
          content.byteOffset,
          content.byteOffset + content.byteLength
        );
        return new Response(arrayBuffer, {
          headers: {
            "Content-Type": mimeType,
            "Content-Length": String(content.byteLength),
          },
        });
      }

      const cached = cache.get(validatedPath);
      if (cached) {
        return new Response(cached, {
          headers: { "Content-Type": "text/html" },
        });
      }

      const content = yield* Effect.tryPromise({
        try: () => fs.readFile(validatedPath),
        catch: (err) => new ProtocolError("FileNotFound", validatedPath, err),
      });

      const mimeType = getMimeType(validatedPath);
      const filename = validatedPath.split(/[/\\]/).pop() ?? validatedPath;

      if (isTextMimeType(mimeType)) {
        const html = generateTextPreviewHtml(
          content.toString("utf-8"),
          filename
        );
        cache.set(validatedPath, html);
        return new Response(html, {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (isImageMimeType(mimeType)) {
        const html = generateImagePreviewHtml(filename, rawUrl);
        return new Response(html, {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (isVideoMimeType(mimeType)) {
        const html = generateVideoPreviewHtml(filename, rawUrl);
        return new Response(html, {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (isAudioMimeType(mimeType)) {
        const html = generateAudioPreviewHtml(filename, rawUrl);
        return new Response(html, {
          headers: { "Content-Type": "text/html" },
        });
      }

      const arrayBuffer = content.buffer.slice(
        content.byteOffset,
        content.byteOffset + content.byteLength
      );
      return new Response(arrayBuffer, {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(content.byteLength),
        },
      });
    }),

  generateTextPreview: (content: string, filename: string) =>
    Effect.succeed(generateTextPreviewHtml(content, filename)),

  generateErrorPage: (error: Error, url: string) =>
    Effect.succeed(generateErrorPageHtml(error, url)),

  clearCache: Effect.sync(() => cache.clear()),

  getCacheSize: Effect.succeed(cache.size),
});

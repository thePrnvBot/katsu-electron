import fs from "node:fs/promises";
import path from "node:path";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ProtocolError } from "../shared/types.js";

export interface ProtocolHandler {
  readonly handleRequest: (
    url: string
  ) => Effect.Effect<Response, ProtocolError>;
}

export const ProtocolHandler =
  Context.GenericTag<ProtocolHandler>("ProtocolHandler");

const getMimeType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".css": "text/css",
    ".gif": "image/gif",
    ".go": "text/x-go",
    ".html": "text/html",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript",
    ".json": "application/json",
    ".jsx": "text/javascript",
    ".katsu-html": "text/html",
    ".md": "text/markdown",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".py": "text/x-python",
    ".rs": "text/x-rust",
    ".svg": "image/svg+xml",
    ".ts": "text/typescript",
    ".tsx": "text/typescript",
    ".txt": "text/plain",
    ".wav": "audio/wav",
    ".webm": "video/webm",
  };
  return mimeTypes[ext] ?? "application/octet-stream";
};

const validateFilePath = (
  filePath: string
): Effect.Effect<string, ProtocolError> =>
  Effect.gen(function* validateFilePathGen() {
    if (!path.isAbsolute(filePath)) {
      return yield* Effect.fail(new ProtocolError("InvalidPath", filePath));
    }

    const resolved = path.resolve(filePath);

    const stat = yield* Effect.tryPromise({
      catch: () => new ProtocolError("FileNotFound", filePath),
      try: () => fs.stat(resolved),
    });

    if (!stat.isFile()) {
      return yield* Effect.fail(new ProtocolError("InvalidPath", filePath));
    }

    return resolved;
  });

export const ProtocolHandlerLive = Layer.succeed(ProtocolHandler, {
  handleRequest: (url: string) =>
    Effect.gen(function* handleRequest() {
      const parsedUrl = new URL(url);
      const filePath = decodeURIComponent(parsedUrl.pathname.slice(1));
      const validatedPath = yield* validateFilePath(filePath);

      const content = yield* Effect.tryPromise({
        catch: (err) => new ProtocolError("FileNotFound", validatedPath, err),
        try: () => fs.readFile(validatedPath),
      });

      const mimeType = getMimeType(validatedPath);
      const arrayBuffer = content.buffer.slice(
        content.byteOffset,
        content.byteOffset + content.byteLength
      );
      return new Response(arrayBuffer, {
        headers: {
          "Content-Length": String(content.byteLength),
          "Content-Type": mimeType,
        },
      });
    }),
});

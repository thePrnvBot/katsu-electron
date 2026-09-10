import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ProtocolError } from "../shared/errors/protocol-error.js";
import { getDropsDir, isPathInside } from "../util.js";
import { parseRangeHeader } from "./byte-range.js";

export interface ProtocolHandler {
  readonly handleRequest: (
    request: Request
  ) => Effect.Effect<Response, ProtocolError>;
}

export const ProtocolHandler =
  Context.GenericTag<ProtocolHandler>("ProtocolHandler");

const MIME_TYPES = new Map([
  [".aac", "audio/aac"],
  [".avi", "video/x-msvideo"],
  [".bmp", "image/bmp"],
  [".css", "text/css"],
  [".flac", "audio/flac"],
  [".gif", "image/gif"],
  [".go", "text/x-go"],
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

const getMimeType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES.get(ext) ?? "application/octet-stream";
};

interface ValidatedFile {
  readonly resolved: string;
  readonly size: number;
}

/**
 * The katsu:// protocol may ONLY serve files from the drops dir
 * (renderer-dropped / staged preview files). Anything else — including
 * `..` traversal after resolve — is denied.
 */
const validateFilePath = (
  filePath: string
): Effect.Effect<ValidatedFile, ProtocolError> =>
  Effect.gen(function* validateFilePathGen() {
    if (!path.isAbsolute(filePath)) {
      return yield* new ProtocolError({
        path: filePath,
        reason: "InvalidPath",
      });
    }

    const lexicalResolved = path.resolve(filePath);
    if (!isPathInside(getDropsDir(), lexicalResolved)) {
      return yield* new ProtocolError({
        path: filePath,
        reason: "PermissionDenied",
      });
    }

    const resolved = yield* Effect.tryPromise({
      catch: (cause) =>
        new ProtocolError({
          cause,
          path: lexicalResolved,
          reason: "FileNotFound",
        }),
      try: () => fs.realpath(lexicalResolved),
    });
    const realDropsDir = yield* Effect.tryPromise({
      catch: (cause) =>
        new ProtocolError({
          cause,
          path: getDropsDir(),
          reason: "FileNotFound",
        }),
      try: () => fs.realpath(getDropsDir()),
    });
    if (!isPathInside(realDropsDir, resolved)) {
      return yield* new ProtocolError({
        path: filePath,
        reason: "PermissionDenied",
      });
    }

    const stat = yield* Effect.tryPromise({
      catch: (cause) =>
        new ProtocolError({ cause, path: resolved, reason: "FileNotFound" }),
      try: () => fs.stat(resolved),
    });

    if (!stat.isFile()) {
      return yield* new ProtocolError({
        path: resolved,
        reason: "InvalidPath",
      });
    }

    return { resolved, size: stat.size };
  });

/**
 * Node's `Readable.toWeb` types don't line up with the DOM `ReadableStream`
 * the Response constructor wants, so adapt manually. Pull-based, which also
 * gives real backpressure for large media files.
 */
const webStream = (stream: Readable): ReadableStream<Uint8Array> => {
  const iterator = stream[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    cancel: async () => {
      await iterator.return?.();
    },
    pull: async (controller) => {
      const { done, value } = await iterator.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
  });
};

const baseHeaders = (mimeType: string) => ({
  "Accept-Ranges": "bytes",
  "Content-Type": mimeType,
  "X-Content-Type-Options": "nosniff",
});

export const ProtocolHandlerLive = Layer.succeed(ProtocolHandler, {
  handleRequest: (request: Request) =>
    Effect.gen(function* handleRequest() {
      const url = yield* Effect.try({
        catch: () => new ProtocolError({ reason: "InvalidPath" }),
        try: () => new URL(request.url),
      });
      const filePath = yield* Effect.try({
        catch: () => new ProtocolError({ reason: "InvalidPath" }),
        try: () => decodeURIComponent(url.pathname.slice(1)),
      });
      const { resolved, size } = yield* validateFilePath(filePath);
      const mimeType = getMimeType(resolved);

      const rangeHeader = request.headers.get("range");
      if (rangeHeader) {
        const range = parseRangeHeader(rangeHeader, size);
        if (!range) {
          return new Response(null, {
            headers: { "Content-Range": `bytes */${size}` },
            status: 416,
          });
        }
        const stream = createReadStream(resolved, {
          end: range.end,
          start: range.start,
        });
        return new Response(webStream(stream), {
          headers: {
            ...baseHeaders(mimeType),
            "Content-Length": String(range.end - range.start + 1),
            "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
          },
          status: 206,
        });
      }

      const stream = createReadStream(resolved);
      return new Response(webStream(stream), {
        headers: {
          ...baseHeaders(mimeType),
          "Content-Length": String(size),
        },
        status: 200,
      });
    }),
});

/** Maps a typed protocol failure to an HTTP error response. */
export const protocolErrorResponse = (error: ProtocolError): Response => {
  let status: number;
  if (error.reason === "FileNotFound") {
    status = 404;
  } else if (error.reason === "PermissionDenied") {
    status = 403;
  } else {
    status = 400;
  }
  return new Response(error.reason, { status });
};

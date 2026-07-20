import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { getDropsDir, isPathInside } from "../util.js";
import { ProtocolError } from "../shared/errors/protocol-error.js";

export interface ProtocolHandler {
  readonly handleRequest: (
    request: Request
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

    const resolved = path.resolve(filePath);
    if (!isPathInside(getDropsDir(), resolved)) {
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

interface ByteRange {
  readonly start: number;
  readonly end: number;
}

/** Parses a single `bytes=` range; returns null when unsatisfiable. */
const parseRangeHeader = (header: string, size: number): ByteRange | null => {
  const match = /^bytes=(?<start>\d*)-(?<end>\d*)$/u.exec(header.trim());
  if (!match?.groups) {
    return null;
  }
  const rawStart = match.groups.start;
  const rawEnd = match.groups.end;
  if (!rawStart && !rawEnd) {
    return null;
  }
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }
    return { end: size - 1, start: Math.max(0, size - suffixLength) };
  }
  const start = Number(rawStart);
  if (!Number.isInteger(start) || start < 0 || start >= size) {
    return null;
  }
  const end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  if (!Number.isInteger(end) || end < start) {
    return null;
  }
  return { end, start };
};

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

const baseHeaders = (mimeType: string): Record<string, string> => ({
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
      const filePath = decodeURIComponent(url.pathname.slice(1));
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

import fs from "node:fs/promises";
import path from "node:path";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { app } from "electron";

import { PersistenceError } from "../shared/errors/persistence-error.js";
import type { WindowMetadata } from "../shared/types.js";
import { getUserData } from "../util.js";

const BoundsSchema = Schema.Struct({
  height: Schema.Number,
  width: Schema.Number,
  x: Schema.Number,
  y: Schema.Number,
});

const WindowMetadataSchema = Schema.Struct({
  bounds: BoundsSchema,
  id: Schema.String,
  title: Schema.optional(Schema.String),
  url: Schema.String,
  zIndex: Schema.Number,
});

const WindowsSchema = Schema.Array(WindowMetadataSchema);

export interface Persistence {
  readonly loadState: Effect.Effect<
    readonly WindowMetadata[],
    PersistenceError
  >;
  readonly saveState: (
    windows: readonly WindowMetadata[]
  ) => Effect.Effect<void, PersistenceError>;
}

export const Persistence = Context.GenericTag<Persistence>("Persistence");

const StateFilePath: string = getUserData("windows.json");

export const PersistenceLive = Layer.succeed(Persistence, {
  loadState: Effect.gen(function* loadState() {
    const filePath = StateFilePath;
    try {
      const content = yield* Effect.tryPromise({
        catch: (err) => new PersistenceError("ReadFailed", err),
        try: () => fs.readFile(filePath, "utf-8"),
      });
      const parsed = yield* Effect.try({
        catch: (err) => new PersistenceError("ParseFailed", err),
        try: () => {
          const raw = JSON.parse(content);
          return Schema.decodeUnknownSync(WindowsSchema)(raw);
        },
      });
      return parsed;
    } catch {
      return [];
    }
  }),

  saveState: (windows: readonly WindowMetadata[]) =>
    Effect.gen(function* saveState() {
      const filePath = StateFilePath;
      const tmpPath = `${filePath}.tmp`;
      const content = JSON.stringify(windows, null, 2);

      yield* Effect.tryPromise({
        catch: (err) => new PersistenceError("WriteFailed", err),
        try: () => fs.writeFile(tmpPath, content, "utf-8"),
      });

      yield* Effect.tryPromise({
        catch: (err) => new PersistenceError("AtomicRenameFailed", err),
        try: () => fs.rename(tmpPath, filePath),
      });
    }),
});

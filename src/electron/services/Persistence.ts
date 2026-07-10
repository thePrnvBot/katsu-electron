import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { app } from "electron";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { WindowMetadata } from "../shared/types.js";
import { PersistenceError } from "../shared/types.js";

const BoundsSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
});

const WindowMetadataSchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  bounds: BoundsSchema,
  zIndex: Schema.Number,
  title: Schema.optional(Schema.String),
});

const WindowsSchema = Schema.Array(WindowMetadataSchema);

export interface Persistence {
  readonly loadState: Effect.Effect<
    ReadonlyArray<WindowMetadata>,
    PersistenceError
  >;
  readonly saveState: (
    windows: ReadonlyArray<WindowMetadata>
  ) => Effect.Effect<void, PersistenceError>;
  readonly getStatePath: Effect.Effect<string>;
}

export const Persistence = Context.GenericTag<Persistence>("Persistence");

function getStateFilePath(): string {
  return path.join(app.getPath("userData"), "windows.json");
}

export const PersistenceLive = Layer.succeed(Persistence, {
  getStatePath: Effect.sync(getStateFilePath),

  loadState: Effect.gen(function* () {
    const filePath = getStateFilePath();
    try {
      const content = yield* Effect.tryPromise({
        try: () => fs.readFile(filePath, "utf-8"),
        catch: (err) => new PersistenceError("ReadFailed", err),
      });
      const parsed = yield* Effect.try({
        try: () => {
          const raw = JSON.parse(content);
          return Schema.decodeUnknownSync(WindowsSchema)(raw);
        },
        catch: (err) => new PersistenceError("ParseFailed", err),
      });
      return parsed;
    } catch {
      return [];
    }
  }),

  saveState: (windows: ReadonlyArray<WindowMetadata>) =>
    Effect.gen(function* () {
      const filePath = getStateFilePath();
      const tmpPath = filePath + ".tmp";
      const content = JSON.stringify(windows, null, 2);

      yield* Effect.tryPromise({
        try: () => fs.writeFile(tmpPath, content, "utf-8"),
        catch: (err) => new PersistenceError("WriteFailed", err),
      });

      yield* Effect.tryPromise({
        try: () => fs.rename(tmpPath, filePath),
        catch: (err) => new PersistenceError("AtomicRenameFailed", err),
      });
    }),
});

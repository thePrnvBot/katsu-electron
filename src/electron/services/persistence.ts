import fs from "node:fs/promises";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import type { Settings, WindowMetadata } from "../../shared/contract.js";
import { DEFAULT_SETTINGS } from "../../shared/contract.js";
import { SettingsSchema, WindowsSchema } from "../schemas/ipc-schemas.js";
import type { PersistenceErrorReason } from "../shared/errors/persistence-error.js";
import { PersistenceError } from "../shared/errors/persistence-error.js";
import {
  getSettingsFilePath,
  getStateFilePath,
  writeFileAtomic,
} from "../util.js";

export interface Persistence {
  readonly loadState: Effect.Effect<readonly WindowMetadata[]>;
  readonly saveState: (
    windows: readonly WindowMetadata[]
  ) => Effect.Effect<void, PersistenceError>;
  readonly loadSettings: Effect.Effect<Settings>;
  readonly saveSettings: (
    settings: Settings
  ) => Effect.Effect<void, PersistenceError>;
}

export const Persistence = Context.GenericTag<Persistence>("Persistence");

const persistenceError = (
  cause: unknown,
  reason: PersistenceErrorReason
): PersistenceError => new PersistenceError({ cause, reason });

const writeFile = (
  filePath: () => string,
  content: string
): Effect.Effect<void, PersistenceError> =>
  writeFileAtomic(filePath(), content, {
    rename: (cause) => persistenceError(cause, "AtomicRenameFailed"),
    write: (cause) => persistenceError(cause, "WriteFailed"),
  });

const readFileAndDecode = <A, I>(
  filePath: () => string,
  schema: Schema.Schema<A, I>
): Effect.Effect<A, PersistenceError> =>
  Effect.gen(function* decodeFile() {
    const content = yield* Effect.tryPromise({
      catch: (cause) => persistenceError(cause, "ReadFailed"),
      try: () => fs.readFile(filePath(), "utf-8"),
    });
    return yield* Effect.try({
      catch: (cause) => persistenceError(cause, "ParseFailed"),
      try: () => Schema.decodeUnknownSync(schema)(JSON.parse(content)),
    });
  });

export const PersistenceLive = Layer.succeed(Persistence, {
  loadSettings: readFileAndDecode(getSettingsFilePath, SettingsSchema).pipe(
    Effect.catchAll(() => Effect.succeed(DEFAULT_SETTINGS))
  ),
  loadState: readFileAndDecode(getStateFilePath, WindowsSchema).pipe(
    Effect.catchAll(() => Effect.succeed([]))
  ),
  saveSettings: (settings) =>
    writeFile(getSettingsFilePath, JSON.stringify(settings, null, 2)),
  saveState: (windows) =>
    writeFile(getStateFilePath, JSON.stringify(windows, null, 2)),
});

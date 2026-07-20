import fs from "node:fs/promises";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import type { Settings, WindowMetadata } from "../../shared/contract.js";
import { DEFAULT_SETTINGS } from "../../shared/contract.js";
import { SettingsSchema, WindowsSchema } from "../schemas/ipc-schemas.js";

import {
  getSettingsFilePath,
  getStateFilePath,
  writeFileAtomic,
} from "../util.js";
import { PersistenceError } from "../shared/errors/persistence-error.js";

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

export const PersistenceLive = Layer.succeed(Persistence, {
  loadSettings: Effect.gen(function* loadSettings() {
    const content = yield* Effect.tryPromise({
      catch: (cause) => new PersistenceError({ cause, reason: "ReadFailed" }),
      try: () => fs.readFile(getSettingsFilePath(), "utf-8"),
    });
    return yield* Effect.try({
      catch: (cause) => new PersistenceError({ cause, reason: "ParseFailed" }),
      try: () => Schema.decodeUnknownSync(SettingsSchema)(JSON.parse(content)),
    });
  }).pipe(Effect.catchAll(() => Effect.succeed(DEFAULT_SETTINGS))),

  loadState: Effect.gen(function* loadState() {
    const content = yield* Effect.tryPromise({
      catch: (cause) => new PersistenceError({ cause, reason: "ReadFailed" }),
      try: () => fs.readFile(getStateFilePath(), "utf-8"),
    });
    return yield* Effect.try({
      catch: (cause) => new PersistenceError({ cause, reason: "ParseFailed" }),
      try: () => Schema.decodeUnknownSync(WindowsSchema)(JSON.parse(content)),
    });
  }).pipe(Effect.catchAll(() => Effect.succeed([]))),

  saveSettings: (settings: Settings) =>
    writeFileAtomic(getSettingsFilePath(), JSON.stringify(settings, null, 2), {
      rename: (cause) =>
        new PersistenceError({ cause, reason: "AtomicRenameFailed" }),
      write: (cause) => new PersistenceError({ cause, reason: "WriteFailed" }),
    }),

  saveState: (windows: readonly WindowMetadata[]) =>
    writeFileAtomic(getStateFilePath(), JSON.stringify(windows, null, 2), {
      rename: (cause) =>
        new PersistenceError({ cause, reason: "AtomicRenameFailed" }),
      write: (cause) => new PersistenceError({ cause, reason: "WriteFailed" }),
    }),
});

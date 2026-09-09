import fs from "node:fs/promises";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import type { Settings, WindowMetadata } from "../../shared/contract.js";
import { DEFAULT_SETTINGS } from "../../shared/contract.js";
import {
  SettingsSchema,
  WindowsSchema,
  WorkspacesSchema,
} from "../schemas/ipc-schemas.js";
import type { PersistenceErrorReason } from "../shared/errors/persistence-error.js";
import { PersistenceError } from "../shared/errors/persistence-error.js";
import {
  getSettingsFilePath,
  getStateFilePath,
  getWorkspacesFilePath,
  writeFileAtomic,
} from "../util.js";

/** One named window setup stored in `workspaces.json`. */
export interface WorkspaceEntry {
  readonly name: string;
  readonly windows: readonly WindowMetadata[];
}

export interface Persistence {
  readonly loadState: Effect.Effect<readonly WindowMetadata[]>;
  readonly saveState: (
    windows: readonly WindowMetadata[]
  ) => Effect.Effect<void, PersistenceError>;
  readonly loadSettings: Effect.Effect<Settings>;
  readonly saveSettings: (
    settings: Settings
  ) => Effect.Effect<void, PersistenceError>;
  /** All saved workspaces (empty when the file is missing or corrupt). */
  readonly loadWorkspaces: Effect.Effect<readonly WorkspaceEntry[]>;
  /** Insert or overwrite a workspace entry (serialized per file). */
  readonly saveWorkspace: (
    name: string,
    windows: readonly WindowMetadata[]
  ) => Effect.Effect<void, PersistenceError>;
  /** Remove a workspace entry (no-op when the name is unknown). */
  readonly deleteWorkspace: (
    name: string
  ) => Effect.Effect<void, PersistenceError>;
}

export const Persistence = Context.GenericTag<Persistence>("Persistence");

const persistenceError = (
  cause: unknown,
  reason: PersistenceErrorReason
): PersistenceError => new PersistenceError({ cause, reason });

const pendingWrites = new Map<string, Promise<void>>();

/**
 * Serialize every write to a file through one promise chain so concurrent
 * save requests cannot interleave temp-file renames or clobber each other.
 * `composeContent` runs inside the queue, letting callers do read-modify-write
 * against the latest on-disk state.
 */
const queueWriteOperation = async (
  targetPath: string,
  composeContent: () => string | Promise<string>
): Promise<void> => {
  const previous = pendingWrites.get(targetPath);
  const operation = (async () => {
    if (previous) {
      try {
        await previous;
      } catch {
        // A failed write must not block later saves.
      }
    }
    await Effect.runPromise(
      writeFileAtomic(targetPath, await composeContent(), {
        rename: (cause) => persistenceError(cause, "AtomicRenameFailed"),
        write: (cause) => persistenceError(cause, "WriteFailed"),
      })
    );
  })();
  pendingWrites.set(targetPath, operation);

  try {
    await operation;
  } finally {
    if (pendingWrites.get(targetPath) === operation) {
      pendingWrites.delete(targetPath);
    }
  }
};

const writeFile = (
  filePath: () => string,
  content: string
): Effect.Effect<void, PersistenceError> => {
  const targetPath = filePath();

  return Effect.tryPromise({
    catch: (cause) =>
      cause instanceof PersistenceError
        ? cause
        : persistenceError(cause, "WriteFailed"),
    try: () => queueWriteOperation(targetPath, () => content),
  });
};

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

/**
 * Workspace library stored as `workspaces.json`. A missing or corrupt file
 * yields an empty library — workspaces are a convenience, never a failure.
 */
const readWorkspaces = async (): Promise<readonly WorkspaceEntry[]> => {
  try {
    const content = await fs.readFile(getWorkspacesFilePath(), "utf-8");
    return Schema.decodeUnknownSync(WorkspacesSchema)(JSON.parse(content));
  } catch {
    return [];
  }
};

export const PersistenceLive = Layer.succeed(Persistence, {
  deleteWorkspace: (name) =>
    Effect.tryPromise({
      catch: (cause) =>
        cause instanceof PersistenceError
          ? cause
          : persistenceError(cause, "WriteFailed"),
      try: () =>
        queueWriteOperation(getWorkspacesFilePath(), async () => {
          const existing = await readWorkspaces();
          const remaining: WorkspaceEntry[] = [...existing].filter(
            (entry) => entry.name !== name
          );
          return JSON.stringify(remaining, null, 2);
        }),
    }),
  loadSettings: readFileAndDecode(getSettingsFilePath, SettingsSchema).pipe(
    Effect.catchAll(() => Effect.succeed(DEFAULT_SETTINGS))
  ),
  loadState: readFileAndDecode(getStateFilePath, WindowsSchema).pipe(
    Effect.catchAll(() => Effect.succeed([]))
  ),
  loadWorkspaces: Effect.promise(readWorkspaces),
  saveSettings: (settings) =>
    writeFile(getSettingsFilePath, JSON.stringify(settings, null, 2)),
  saveState: (windows) =>
    writeFile(getStateFilePath, JSON.stringify(windows, null, 2)),
  saveWorkspace: (name, windows) =>
    Effect.tryPromise({
      catch: (cause) =>
        cause instanceof PersistenceError
          ? cause
          : persistenceError(cause, "WriteFailed"),
      try: () =>
        queueWriteOperation(getWorkspacesFilePath(), async () => {
          const existing = await readWorkspaces();
          const remaining: WorkspaceEntry[] = [...existing].filter(
            (entry) => entry.name !== name
          );
          remaining.push({ name, windows });
          return JSON.stringify(remaining, null, 2);
        }),
    }),
});

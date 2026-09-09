import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { dialog, ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";

import type {
  IPCCommand,
  TerminalResizePayload,
  TerminalSpawnOptions,
  TerminalWritePayload,
  WindowMetadata,
} from "../../shared/contract.js";
import { MAX_TEMP_FILE_BYTES } from "../../shared/contract.js";
import { IpcChannel } from "../../shared/ipc-channels.js";
import { completeSaveAndQuit } from "../quit-flow.js";
import { mainRuntime } from "../runtime.js";
import {
  TerminalIdSchema,
  TerminalResizePayloadSchema,
  TerminalSpawnOptionsSchema,
  TerminalWritePayloadSchema,
  TempFileSavePayloadSchema,
  WindowsSchema,
  WorkspaceSavePayloadSchema,
} from "../schemas/ipc-schemas.js";
import { FileStaging } from "../services/file-staging.js";
import { IPCRouter } from "../services/ipc-router.js";
import { Persistence } from "../services/persistence.js";
import { TerminalService } from "../services/terminal.js";
import { getDropsDir, isPathInside, sanitizeTempFileName } from "../util.js";
import { getMainWindow } from "../window-manager.js";

/**
 * Every privileged handler proves the caller is the app's own main-window
 * frame — never a webview guest or a third-party frame.
 */
const assertMainWindowSender = (event: IpcMainInvokeEvent): void => {
  const win = getMainWindow();
  if (!win || event.senderFrame !== win.webContents.mainFrame) {
    throw new Error("Unauthorized IPC sender");
  }
};

const unauthorizedResult = { error: "unauthorized", success: false } as const;

/**
 * Runtime-validate a payload at the IPC boundary: `A` is inferred from the
 * schema, the annotation records the wire's declared shape, and the decode
 * enforces it. Failures reject the `ipcMain.handle` promise.
 */
const decodePayload = <A>(
  schema: Schema.Schema<A>,
  payload: A,
  message: string
): Effect.Effect<A, Error> =>
  Effect.try({
    catch: (cause) => new Error(message, { cause }),
    try: () => Schema.decodeUnknownSync(schema)(payload),
  });

export const registerIpcHandlers = (): void => {
  // Unified command router
  ipcMain.handle(IpcChannel.command, async (event, command: IPCCommand) => {
    try {
      assertMainWindowSender(event);
    } catch {
      return unauthorizedResult;
    }

    const program = Effect.gen(function* program() {
      const router = yield* IPCRouter;
      return yield* router.handleCommand(command);
    });

    try {
      const result = await mainRuntime.runPromise(program);
      return { data: result, success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: message, success: false };
    }
  });

  // Dialog: open file (grants stage capability for the picked paths)
  ipcMain.handle(IpcChannel.dialogOpenFile, async (event) => {
    assertMainWindowSender(event);
    const win = getMainWindow();
    if (!win) {
      return { canceled: true, filePaths: [] };
    }
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
    });
    await mainRuntime.runPromise(
      Effect.gen(function* grantStaging() {
        const staging = yield* FileStaging;
        yield* staging.grantPaths(result.filePaths);
      })
    );
    return { canceled: result.canceled, filePaths: result.filePaths };
  });

  // FS: stage a dialog-granted file into the drops dir (main-process copy,
  // no renderer round-trip). Returns the staged path for katsu:// URLs.
  ipcMain.handle(IpcChannel.fsStageFile, async (event, filePath: string) => {
    assertMainWindowSender(event);
    const parsedFilePath = await mainRuntime.runPromise(
      decodePayload(Schema.String, filePath, "invalid staged file path")
    );
    const granted = await mainRuntime.runPromise(
      Effect.gen(function* consumeGrant() {
        const staging = yield* FileStaging;
        return yield* staging.consumePath(parsedFilePath);
      })
    );
    if (!granted) {
      throw new Error("Path was not granted by the open dialog");
    }
    const dir = getDropsDir();
    await fs.mkdir(dir, { recursive: true });
    const sourceStat = await fs.stat(parsedFilePath);
    if (sourceStat.size > MAX_TEMP_FILE_BYTES) {
      throw new Error("File exceeds maximum allowed size");
    }
    const stagedPath = path.join(
      dir,
      `${crypto.randomUUID()}-${sanitizeTempFileName(path.basename(parsedFilePath))}`
    );
    await fs.copyFile(parsedFilePath, stagedPath);
    return { name: path.basename(parsedFilePath), path: stagedPath };
  });

  // FS: delete a temp preview file (must live inside the drops dir)
  ipcMain.handle(
    IpcChannel.fsDeleteTempFile,
    async (event, filePath: string) => {
      assertMainWindowSender(event);
      const parsedFilePath = await mainRuntime.runPromise(
        decodePayload(Schema.String, filePath, "invalid temp file path")
      );
      const resolved = path.resolve(parsedFilePath);
      if (!isPathInside(getDropsDir(), resolved)) {
        return;
      }
      await fs.rm(resolved, { force: true });
    }
  );

  // Dialog: save a renderer-dropped file into the drops dir
  ipcMain.handle(
    IpcChannel.dialogSaveTempFile,
    async (event, args: { name: string; buffer: ArrayBuffer }) => {
      assertMainWindowSender(event);
      const parsed = await mainRuntime.runPromise(
        decodePayload(
          TempFileSavePayloadSchema,
          args,
          "invalid temp file payload"
        )
      );
      if (!(parsed.buffer instanceof ArrayBuffer)) {
        throw new Error("Invalid temp file buffer");
      }
      if (parsed.buffer.byteLength > MAX_TEMP_FILE_BYTES) {
        throw new Error("File exceeds maximum allowed size");
      }
      const dir = getDropsDir();
      await fs.mkdir(dir, { recursive: true });
      const filePath = path.join(
        dir,
        `${crypto.randomUUID()}-${sanitizeTempFileName(parsed.name)}`
      );
      await fs.writeFile(filePath, Buffer.from(parsed.buffer));
      return filePath;
    }
  );

  // Terminal: spawn a new PTY session, returns its id.
  ipcMain.handle(
    IpcChannel.terminalSpawn,
    async (event, options: TerminalSpawnOptions) => {
      assertMainWindowSender(event);
      return await mainRuntime.runPromise(
        Effect.gen(function* spawnTerminal() {
          const parsed = yield* decodePayload(
            TerminalSpawnOptionsSchema,
            options,
            "invalid terminal spawn options"
          );
          const terminals = yield* TerminalService;
          return yield* terminals.spawn(parsed);
        })
      );
    }
  );

  // Terminal: write input into a PTY session.
  ipcMain.handle(
    IpcChannel.terminalWrite,
    async (event, payload: TerminalWritePayload) => {
      assertMainWindowSender(event);
      await mainRuntime.runPromise(
        Effect.gen(function* writeTerminal() {
          const parsed = yield* decodePayload(
            TerminalWritePayloadSchema,
            payload,
            "invalid terminal write payload"
          );
          const terminals = yield* TerminalService;
          yield* terminals.write(parsed.id, parsed.data);
        })
      );
    }
  );

  // Terminal: resize a PTY session to match the renderer's fit-addon dims.
  ipcMain.handle(
    IpcChannel.terminalResize,
    async (event, payload: TerminalResizePayload) => {
      assertMainWindowSender(event);
      await mainRuntime.runPromise(
        Effect.gen(function* resizeTerminal() {
          const parsed = yield* decodePayload(
            TerminalResizePayloadSchema,
            payload,
            "invalid terminal resize payload"
          );
          const terminals = yield* TerminalService;
          yield* terminals.resize(parsed.id, parsed.cols, parsed.rows);
        })
      );
    }
  );

  // Terminal: kill a PTY session (window close / unmount).
  ipcMain.handle(IpcChannel.terminalKill, async (event, id: string) => {
    assertMainWindowSender(event);
    await mainRuntime.runPromise(
      Effect.gen(function* killTerminal() {
        const parsed = yield* decodePayload(
          TerminalIdSchema,
          id,
          "invalid terminal id"
        );
        const terminals = yield* TerminalService;
        yield* terminals.kill(parsed);
      })
    );
  });

  // State: save response (before quit). An empty list is valid state —
  // closing all windows must persist as "no windows", not resurrect stale ones.
  ipcMain.handle(
    IpcChannel.stateSaveResponse,
    async (event, windows: WindowMetadata[]) => {
      assertMainWindowSender(event);
      try {
        await mainRuntime.runPromise(
          Effect.gen(function* program() {
            const parsed = yield* decodePayload(
              WindowsSchema,
              windows,
              "invalid state payload"
            );
            const persistence = yield* Persistence;
            yield* persistence.saveState(parsed);
          })
        );
      } catch (error) {
        console.error("Failed to save state on quit:", error);
      } finally {
        completeSaveAndQuit();
      }
    }
  );

  // Workspace: list saved workspaces (name + window count), sorted by name.
  ipcMain.handle(IpcChannel.workspaceList, async (event) => {
    assertMainWindowSender(event);
    return await mainRuntime.runPromise(
      Effect.gen(function* listWorkspaces() {
        const persistence = yield* Persistence;
        const entries = yield* persistence.loadWorkspaces;
        return entries
          .map((entry) => ({
            name: entry.name,
            windowCount: entry.windows.length,
          }))
          .toSorted((a, b) => a.name.localeCompare(b.name));
      })
    );
  });

  // Workspace: save current windows under a user-chosen name (overwrites).
  ipcMain.handle(
    IpcChannel.workspaceSave,
    async (event, payload: { name: string; windows: WindowMetadata[] }) => {
      assertMainWindowSender(event);
      const parsed = await mainRuntime.runPromise(
        decodePayload(
          WorkspaceSavePayloadSchema,
          payload,
          "invalid workspace save payload"
        )
      );
      const name = parsed.name.trim();
      if (name.length === 0) {
        throw new Error("Workspace name cannot be empty");
      }
      await mainRuntime.runPromise(
        Effect.gen(function* saveWorkspace() {
          const persistence = yield* Persistence;
          yield* persistence.saveWorkspace(name, parsed.windows);
        })
      );
    }
  );

  // Workspace: load saved windows by name (null when the name is unknown).
  ipcMain.handle(IpcChannel.workspaceLoad, async (event, name: string) => {
    assertMainWindowSender(event);
    const parsedName = await mainRuntime.runPromise(
      decodePayload(Schema.String, name, "invalid workspace name")
    );
    return await mainRuntime.runPromise(
      Effect.gen(function* loadWorkspace() {
        const persistence = yield* Persistence;
        const entries = yield* persistence.loadWorkspaces;
        const entry = entries.find(
          (candidate) => candidate.name === parsedName
        );
        return entry ? entry.windows : null;
      })
    );
  });

  // Workspace: delete a saved workspace by name (no-op when unknown).
  ipcMain.handle(IpcChannel.workspaceDelete, async (event, name: string) => {
    assertMainWindowSender(event);
    const parsedName = await mainRuntime.runPromise(
      decodePayload(Schema.String, name, "invalid workspace name")
    );
    await mainRuntime.runPromise(
      Effect.gen(function* deleteWorkspace() {
        const persistence = yield* Persistence;
        yield* persistence.deleteWorkspace(parsedName);
      })
    );
  });
};

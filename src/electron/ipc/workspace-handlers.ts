/** Workspace IPC handlers: list, save, load, and delete named window setups. */

import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ipcMain } from "electron";

import type { WindowMetadata } from "../../shared/contract.js";
import { IpcChannel } from "../../shared/ipc-channels.js";
import { mainRuntime } from "../runtime.js";
import { WorkspaceSavePayloadSchema } from "../schemas/ipc-schemas.js";
import { Persistence } from "../services/persistence.js";
import { assertMainWindowSender, decodePayload } from "./guards.js";

export const registerWorkspaceHandlers = (): void => {
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

/** Quit-time IPC handler persisting renderer window state before shutdown. */

import * as Effect from "effect/Effect";
import { ipcMain } from "electron";

import type { WindowMetadata } from "../../shared/contract.js";
import { IpcChannel } from "../../shared/ipc-channels.js";
import { completeSaveAndQuit } from "../quit-flow.js";
import { mainRuntime } from "../runtime.js";
import { WindowsSchema } from "../schemas/ipc-schemas.js";
import { Persistence } from "../services/persistence.js";
import { assertMainWindowSender, decodePayload } from "./guards.js";

export const registerStateHandlers = (): void => {
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
};

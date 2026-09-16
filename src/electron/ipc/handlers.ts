/** IPC entry: registers the unified command router and each domain handler group. */

import * as Effect from "effect/Effect";
import { ipcMain } from "electron";

import type { IPCCommand } from "../../shared/contract.js";
import { IpcChannel } from "../../shared/ipc-channels.js";
import { mainRuntime } from "../runtime.js";
import { IPCRouter } from "../services/ipc-router.js";
import { registerArtifactHandlers } from "./artifact-handlers.js";
import { registerDialogHandlers } from "./dialog-handlers.js";
import { assertMainWindowSender, unauthorizedResult } from "./guards.js";
import { registerStateHandlers } from "./state-handlers.js";
import { registerTerminalHandlers } from "./terminal-handlers.js";
import { registerWorkspaceHandlers } from "./workspace-handlers.js";

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

  registerArtifactHandlers();
  registerDialogHandlers();
  registerStateHandlers();
  registerTerminalHandlers();
  registerWorkspaceHandlers();
};

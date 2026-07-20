import { app } from "electron";

import { IpcChannel } from "../shared/ipc-channels.js";
import { mainRuntime } from "./runtime.js";
import { cleanDropsDir } from "./util.js";
import { getMainWindow } from "./window-manager.js";

/**
 * Quit coordination: Electron does not await async `before-quit` handlers,
 * and the `closed` event nulls the window before `before-quit` fires on a
 * normal close — both caused state-loss-on-quit races.
 *
 * Flow: first quit/close attempt is intercepted (`phase` idle -> saving),
 * the renderer is asked for its state, and only when the save lands (or the
 * timeout backstop fires) do we re-trigger the real quit.
 */

type QuitPhase = "idle" | "saving" | "done";

let phase: QuitPhase = "idle";
let timeout: NodeJS.Timeout | null = null;

const SAVE_TIMEOUT_MS = 2000;

export const quitInProgress = (): boolean => phase !== "idle";

export const completeSaveAndQuit = (): void => {
  if (phase === "done") {
    return;
  }
  phase = "done";
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }
  void mainRuntime.runPromise(cleanDropsDir());
  app.quit();
};

export const beginSaveAndQuit = (): void => {
  if (phase !== "idle") {
    return;
  }
  phase = "saving";

  const win = getMainWindow();
  if (!win || win.isDestroyed()) {
    completeSaveAndQuit();
    return;
  }

  win.webContents.send(IpcChannel.stateRequestSave);
  timeout = setTimeout(completeSaveAndQuit, SAVE_TIMEOUT_MS);
};

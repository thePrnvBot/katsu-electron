import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import * as Effect from "effect/Effect";
import { app, dialog, ipcMain } from "electron";

import { MainLayer } from "../layers/main-layer.js";
import { IPCRouter } from "../services/ipc-router.js";
import { Persistence } from "../services/persistence.js";
import type { WindowMetadata } from "../shared/types.js";
import { getUserData } from "../util.js";
import { getMainWindow } from "../window-manager.js";

const SETTINGS_PATH = getUserData("settings.json");

export const registerIpcHandlers = (): void => {
  // Unified command router
  ipcMain.handle("katsu:command", async (_event, command: unknown) => {
    const program = Effect.gen(function* program() {
      const router = yield* IPCRouter;
      return yield* router.handleCommand(command);
    });

    try {
      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MainLayer))
      );
      return { data: result, success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: message, success: false };
    }
  });

  // Dialog: open file
  ipcMain.handle("dialog:openFile", async () => {
    const win = getMainWindow();
    if (!win) {
      return { canceled: true, filePaths: [] };
    }
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
    });
    return { canceled: result.canceled, filePaths: result.filePaths };
  });

  // FS: read file
  ipcMain.handle("fs:readFile", async (_event, filePath: string) => {
    const name = path.basename(filePath);
    const buffer = await fs.readFile(filePath);
    return { buffer, name };
  });

  // Dialog: save temp file
  ipcMain.handle(
    "dialog:saveTempFile",
    async (_event, args: { name: string; buffer: ArrayBuffer }) => {
      const dir = path.join(app.getPath("temp"), "katsu-drops");
      await fs.mkdir(dir, { recursive: true });
      const id = crypto.randomUUID();
      const filePath = path.join(dir, `${id}-${args.name}`);
      const buffer = Buffer.from(args.buffer);
      await fs.writeFile(filePath, buffer);
      return filePath;
    }
  );

  // Settings: load
  ipcMain.handle("settings:load", async () => {
    try {
      const content = await fs.readFile(SETTINGS_PATH, "utf-8");
      return JSON.parse(content);
    } catch {
      return { windowPeeking: false };
    }
  });

  // State: save response (before quit)
  ipcMain.handle(
    "state:saveResponse",
    async (_event, windows: WindowMetadata[]) => {
      if (!windows || windows.length === 0) {
        return;
      }

      const program = Effect.gen(function* program() {
        const persistence = yield* Persistence;
        return yield* persistence.saveState(windows);
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(MainLayer)));
      } catch (error) {
        console.error("Failed to save state on quit:", error);
      }
    }
  );
};

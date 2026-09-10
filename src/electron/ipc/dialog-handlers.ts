import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { dialog, ipcMain } from "electron";

import { MAX_TEMP_FILE_BYTES } from "../../shared/contract.js";
import { IpcChannel } from "../../shared/ipc-channels.js";
import { mainRuntime } from "../runtime.js";
import { TempFileSavePayloadSchema } from "../schemas/ipc-schemas.js";
import { FileStaging } from "../services/file-staging.js";
import { getDropsDir, isPathInside, sanitizeTempFileName } from "../util.js";
import { getMainWindow } from "../window-manager.js";
import { assertMainWindowSender, decodePayload } from "./guards.js";

export const registerDialogHandlers = (): void => {
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
  // no renderer round-trip). The tree is validated BEFORE the grant is
  // consumed so a missing or oversized file cannot burn the capability the
  // user paid a native dialog for.
  ipcMain.handle(IpcChannel.fsStageFile, async (event, filePath: string) => {
    assertMainWindowSender(event);
    const parsedFilePath = await mainRuntime.runPromise(
      decodePayload(Schema.String, filePath, "invalid staged file path")
    );
    const grantedBeforeValidation = await mainRuntime.runPromise(
      Effect.gen(function* checkGrant() {
        const staging = yield* FileStaging;
        return yield* staging.hasPath(parsedFilePath);
      })
    );
    if (!grantedBeforeValidation) {
      throw new Error("Path was not granted by the open dialog");
    }
    const dir = getDropsDir();
    await fs.mkdir(dir, { recursive: true });
    const sourceStat = await fs.stat(parsedFilePath);
    if (sourceStat.size > MAX_TEMP_FILE_BYTES) {
      throw new Error("File exceeds maximum allowed size");
    }
    const granted = await mainRuntime.runPromise(
      Effect.gen(function* consumeGrant() {
        const staging = yield* FileStaging;
        return yield* staging.consumePath(parsedFilePath);
      })
    );
    if (!granted) {
      throw new Error("Path was not granted by the open dialog");
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
};

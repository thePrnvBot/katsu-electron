/** Shared IPC guardrails: main-window sender assertion and boundary payload decode. */

import * as Effect from "effect/Effect";
import type * as Schema from "effect/Schema";
import type { IpcMainInvokeEvent } from "electron";

import { decodeAtBoundary } from "../schemas/decode.js";
import { getMainWindow } from "../window-manager.js";

/**
 * Every privileged handler proves the caller is the app's own main-window
 * frame — never a webview guest or a third-party frame.
 */
export const assertMainWindowSender = (event: IpcMainInvokeEvent): void => {
  const win = getMainWindow();
  if (!win || event.senderFrame !== win.webContents.mainFrame) {
    throw new Error("Unauthorized IPC sender");
  }
};

export const unauthorizedResult = {
  error: "unauthorized",
  success: false,
} as const;

/**
 * Runtime-validate a payload at the IPC boundary: `A` is inferred from the
 * schema, the annotation records the wire's declared shape, and the decode
 * enforces it. Failures reject the `ipcMain.handle` promise.
 */
export const decodePayload = <A>(
  schema: Schema.Schema<A>,
  payload: A,
  message: string
): Effect.Effect<A, Error> =>
  decodeAtBoundary(schema, payload).pipe(
    Effect.mapError((cause) => new Error(message, { cause }))
  );

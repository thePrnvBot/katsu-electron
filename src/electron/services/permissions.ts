import crypto from "node:crypto";

import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import type { PermissionRequestPayload } from "../../shared/contract.js";
import { IpcChannel } from "../../shared/ipc-channels.js";
import { getMainWindow } from "../window-manager.js";

const REQUEST_TIMEOUT_MS = 60_000;

export interface Permissions {
  /**
   * Ask the user (via the renderer permission dialog) whether to grant a
   * permission. Resolves false on timeout or when no window is available.
   * Concurrent requests are independent — each gets its own dialog slot.
   */
  readonly requestPermission: (input: {
    readonly permission: string;
    readonly origin: string;
    readonly message: string;
    readonly securityOrigin?: string;
  }) => Effect.Effect<boolean>;
  readonly respondToRequest: (
    requestId: string,
    granted: boolean
  ) => Effect.Effect<void>;
  /** Previously granted `origin:permission` pairs (for permission checks). */
  readonly wasGranted: (origin: string, permission: string) => boolean;
  /**
   * Checks if the permission was granted for any of the given origins.
   * Handles cases where Chromium reports different origin representations
   * for the same frame (e.g. `requestingOrigin` vs `securityOrigin`).
   */
  readonly wasGrantedForOrigins: (
    origins: readonly string[],
    permission: string
  ) => boolean;
}

export const Permissions = Context.GenericTag<Permissions>("Permissions");

export const PermissionsLive = Layer.sync(Permissions, () => {
  /** id -> reply slot for requests the renderer has not answered yet. */
  const pendingRequests = new Map<string, Deferred.Deferred<boolean>>();
  const grantedPermissions = new Set<string>();

  const requestPermission: Permissions["requestPermission"] = ({
    message,
    origin,
    permission,
    securityOrigin,
  }) =>
    Effect.gen(function* ask() {
      const win = getMainWindow();
      if (!win || win.isDestroyed()) {
        return false;
      }

      const id = crypto.randomUUID();
      const reply = yield* Deferred.make<boolean>();
      pendingRequests.set(id, reply);

      const payload: PermissionRequestPayload = {
        id,
        message,
        origin,
        permission,
      };
      win.webContents.send(IpcChannel.permissionRequest, payload);

      // Dialog answer or timeout — whichever lands first. A late answer
      // finds no map entry and is dropped.
      const answered = yield* Deferred.await(reply).pipe(
        Effect.timeoutOption(REQUEST_TIMEOUT_MS)
      );
      pendingRequests.delete(id);

      if (Option.isNone(answered)) {
        // The dialog is still on screen in the renderer — dismiss it so a
        // late "Allow" click cannot look like it worked.
        const currentWin = getMainWindow();
        if (currentWin && !currentWin.isDestroyed()) {
          currentWin.webContents.send(IpcChannel.permissionCancelled, id);
        }
        return false;
      }

      const granted = answered.value;
      if (granted) {
        grantedPermissions.add(`${origin}:${permission}`);
        if (securityOrigin && securityOrigin !== origin) {
          grantedPermissions.add(`${securityOrigin}:${permission}`);
        }
      }
      return granted;
    });

  const respondToRequest: Permissions["respondToRequest"] = (
    requestId,
    granted
  ) =>
    Effect.gen(function* answer() {
      const reply = pendingRequests.get(requestId);
      if (!reply) {
        return;
      }
      pendingRequests.delete(requestId);
      yield* Deferred.succeed(reply, granted);
    });

  const wasGranted: Permissions["wasGranted"] = (origin, permission) =>
    grantedPermissions.has(`${origin}:${permission}`);

  const wasGrantedForOrigins: Permissions["wasGrantedForOrigins"] = (
    origins,
    permission
  ) =>
    origins.some((origin) => grantedPermissions.has(`${origin}:${permission}`));

  return {
    requestPermission,
    respondToRequest,
    wasGranted,
    wasGrantedForOrigins,
  };
});

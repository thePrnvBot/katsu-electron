import crypto from "node:crypto";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type { PermissionRequestPayload } from "../../shared/contract.js";
import { IpcChannel } from "../../shared/ipc-channels.js";
import { getMainWindow } from "../window-manager.js";

const REQUEST_TIMEOUT_MS = 60_000;

export interface Permissions {
  /**
   * Ask the user (via the renderer permission dialog) whether to grant a
   * permission. Resolves false on timeout or when no window is available.
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

const pendingRequests = new Map<
  string,
  { resolve: (granted: boolean) => void; timeout: NodeJS.Timeout }
>();

const grantedPermissions = new Set<string>();

export const PermissionsLive = Layer.succeed(Permissions, {
  requestPermission: ({ permission, origin, message, securityOrigin }) =>
    Effect.async<boolean>((resume) => {
      const win = getMainWindow();
      if (!win || win.isDestroyed()) {
        resume(Effect.succeed(false));
        return;
      }

      const id = crypto.randomUUID();
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        resume(Effect.succeed(false));
      }, REQUEST_TIMEOUT_MS);

      pendingRequests.set(id, {
        resolve: (granted) => {
          if (granted) {
            grantedPermissions.add(`${origin}:${permission}`);
            if (securityOrigin && securityOrigin !== origin) {
              grantedPermissions.add(`${securityOrigin}:${permission}`);
            }
          }
          resume(Effect.succeed(granted));
        },
        timeout,
      });

      const payload: PermissionRequestPayload = {
        id,
        message,
        origin,
        permission,
      };
      win.webContents.send(IpcChannel.permissionRequest, payload);
    }),

  respondToRequest: (requestId: string, granted: boolean) =>
    Effect.sync(() => {
      const pending = pendingRequests.get(requestId);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeout);
      pendingRequests.delete(requestId);
      pending.resolve(granted);
    }),

  wasGranted: (origin: string, permission: string) =>
    grantedPermissions.has(`${origin}:${permission}`),

  wasGrantedForOrigins: (origins: readonly string[], permission: string) =>
    origins.some((origin) => grantedPermissions.has(`${origin}:${permission}`)),
});

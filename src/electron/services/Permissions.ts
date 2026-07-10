import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import type { PermissionRequest } from "../shared/types.js";

export interface Permissions {
  readonly respondToRequest: (
    requestId: string,
    granted: boolean
  ) => Effect.Effect<void>;
  readonly getPendingRequests: Effect.Effect<ReadonlyArray<PermissionRequest>>;
}

export const Permissions = Context.GenericTag<Permissions>("Permissions");

const pendingRequests = new Map<
  string,
  { resolve: (granted: boolean) => void; request: PermissionRequest }
>();

export const PermissionsLive = Layer.succeed(Permissions, {
  respondToRequest: (requestId: string, granted: boolean) =>
    Effect.sync(() => {
      const pending = pendingRequests.get(requestId);
      if (pending) {
        pending.resolve(granted);
        pendingRequests.delete(requestId);
      }
    }),

  getPendingRequests: Effect.sync(() =>
    Array.from(pendingRequests.values()).map((p) => p.request)
  ),
});

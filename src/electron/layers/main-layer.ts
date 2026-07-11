import * as Layer from "effect/Layer";

import { AdBlockerLive } from "../services/ad-blocker.js";
import { IPCRouterLive } from "../services/ipc-router.js";
import { PermissionsLive } from "../services/permissions.js";
import { PersistenceLive } from "../services/persistence.js";
import { ProtocolHandlerLive } from "../services/protocol-handler.js";

export const MainLayer = Layer.mergeAll(
  IPCRouterLive,
  ProtocolHandlerLive,
  PersistenceLive,
  PermissionsLive,
  AdBlockerLive
);

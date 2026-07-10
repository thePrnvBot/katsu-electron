import * as Layer from "effect/Layer";
import { IPCRouterLive } from "../services/IPCRouter.js";
import { ProtocolHandlerLive } from "../services/ProtocolHandler.js";
import { PersistenceLive } from "../services/Persistence.js";
import { PermissionsLive } from "../services/Permissions.js";
import { AdBlockerLive } from "../services/AdBlocker.js";

export const MainLayer = Layer.mergeAll(
  IPCRouterLive,
  ProtocolHandlerLive,
  PersistenceLive,
  PermissionsLive,
  AdBlockerLive
);

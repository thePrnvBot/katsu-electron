/** Composes every main-process service into a single Effect layer. */

import * as Layer from "effect/Layer";

import { AdBlockerLive } from "../services/ad-blocker.js";
import { FileStagingLive } from "../services/file-staging.js";
import { IPCRouterLive } from "../services/ipc-router.js";
import { PermissionsLive } from "../services/permissions.js";
import { PersistenceLive } from "../services/persistence.js";
import { ProtocolHandlerLive } from "../services/protocol-handler.js";
import { TerminalServiceLive } from "../services/terminal.js";

export const MainLayer = Layer.mergeAll(
  AdBlockerLive,
  FileStagingLive,
  IPCRouterLive,
  PermissionsLive,
  PersistenceLive,
  ProtocolHandlerLive,
  TerminalServiceLive
);

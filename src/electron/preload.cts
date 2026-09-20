/**
 * Context bridge exposing the typed renderer API: commands, terminal
 * streams, state handlers.
 *
 * This file is compiled to `preload.cjs` (CommonJS) because sandboxed
 * preload scripts cannot be ES modules. Sandboxed preloads may only
 * `require` electron and Node builtins — no local files — so the IPC
 * channel names are inlined here. KEEP THE INLINE MAP IN SYNC WITH
 * `src/shared/ipc-channels.ts` (the contract test in `tests/` enforces it).
 */

import { contextBridge, ipcRenderer } from "electron";

import type {
  ArtifactCancelResponse,
  ArtifactProgressEvent,
  ArtifactProgressPayload,
  ArtifactProviderId,
  ArtifactProviderSummary,
  ArtifactStartResponse,
  IPCCommand,
  PermissionRequestPayload,
  Settings,
  TerminalDataPayload,
  TerminalExitPayload,
  TerminalSpawnOptions,
  TerminalSpawnResult,
  WindowMetadata,
} from "../shared/contract.js";

/**
 * IPC channel names shared between main, preload and renderer — inlined
 * because sandboxed preloads cannot require local modules.
 */
const IpcChannel = {
  adblockCount: "adblock:count",
  artifactCancel: "artifact:cancel",
  artifactGenerate: "artifact:generate",
  artifactProgress: "artifact:progress",
  artifactProviders: "artifact:providers",
  command: "katsu:command",
  dialogOpenFile: "dialog:openFile",
  dialogSaveTempFile: "dialog:saveTempFile",
  fsDeleteTempFile: "fs:deleteTempFile",
  fsStageFile: "fs:stageFile",
  permissionCancelled: "permission:cancelled",
  permissionRequest: "permission:request",
  settingsLoaded: "settings:loaded",
  stateLoaded: "state:loaded",
  stateRequestSave: "state:requestSave",
  stateSaveResponse: "state:saveResponse",
  terminalData: "terminal:data",
  terminalExit: "terminal:exit",
  terminalKill: "terminal:kill",
  terminalResize: "terminal:resize",
  terminalSpawn: "terminal:spawn",
  terminalWrite: "terminal:write",
  workspaceDelete: "workspace:delete",
  workspaceList: "workspace:list",
  workspaceLoad: "workspace:load",
  workspaceSave: "workspace:save",
} as const;

const artifactProgressSubscribers = new Map<
  string,
  (event: ArtifactProgressEvent) => void
>();
/**
 * Terminal events that arrive before the renderer subscribes are buffered,
 * then flushed on subscribe: a fast failure (or success) can land during the
 * `generateArtifact` invoke, before the renderer knows the generation id.
 */
const artifactProgressBacklog = new Map<string, ArtifactProgressEvent[]>();
/**
 * Backlogs for generations that never subscribe (e.g. cancelled before the
 * id reached the renderer) would otherwise accumulate for the app's lifetime.
 * The oldest unsubscribed backlog is evicted once this many are tracked.
 */
const MAX_TRACKED_PROGRESS_BACKLOGS = 64;

const pruneArtifactProgressBacklog = (): void => {
  while (artifactProgressBacklog.size > MAX_TRACKED_PROGRESS_BACKLOGS) {
    const oldestGenerationId = artifactProgressBacklog.keys().next().value;
    if (oldestGenerationId === undefined) {
      return;
    }
    artifactProgressBacklog.delete(oldestGenerationId);
  }
};

ipcRenderer.on(
  IpcChannel.artifactProgress,
  (_event, payload: ArtifactProgressPayload) => {
    const handler = artifactProgressSubscribers.get(payload.generationId);
    if (handler) {
      handler(payload.event);
      return;
    }
    artifactProgressBacklog.set(payload.generationId, [payload.event]);
    pruneArtifactProgressBacklog();
  }
);

/**
 * Blocked-count subscribers, keyed by origin so main's notification reaches
 * only the windows actually showing that origin — no renderer-side filtering.
 * Several windows can show one origin, hence the handler set.
 */
const blockedCountSubscribers = new Map<
  string,
  Set<(data: { count: number; origin: string }) => void>
>();
ipcRenderer.on(IpcChannel.adblockCount, (_event, data) => {
  for (const handler of blockedCountSubscribers.get(data.origin) ?? []) {
    handler(data);
  }
});

const terminalDataSubscribers = new Map<
  string,
  (data: TerminalDataPayload) => void
>();
const terminalDataBacklog = new Map<
  string,
  { bytes: number; events: TerminalDataPayload[] }
>();
const MAX_BUFFERED_TERMINAL_EVENTS = 256;
const MAX_BUFFERED_TERMINAL_BYTES = 256 * 1024;
const MAX_BUFFERED_TERMINAL_SESSIONS = 128;
ipcRenderer.on(IpcChannel.terminalData, (_event, data: TerminalDataPayload) => {
  const handler = terminalDataSubscribers.get(data.id);
  if (handler) {
    handler(data);
    return;
  }

  let backlog = terminalDataBacklog.get(data.id);
  if (!backlog) {
    if (terminalDataBacklog.size >= MAX_BUFFERED_TERMINAL_SESSIONS) {
      const [oldestId] = terminalDataBacklog.keys();
      if (oldestId) {
        terminalDataBacklog.delete(oldestId);
      }
    }
    backlog = { bytes: 0, events: [] };
    terminalDataBacklog.set(data.id, backlog);
  }
  if (
    backlog.events.length < MAX_BUFFERED_TERMINAL_EVENTS &&
    backlog.bytes + data.data.length <= MAX_BUFFERED_TERMINAL_BYTES
  ) {
    backlog.events.push(data);
    backlog.bytes += data.data.length;
  }
});

const terminalExitSubscribers = new Map<
  string,
  (data: TerminalExitPayload) => void
>();
const terminalExitBacklog = new Map<string, TerminalExitPayload>();
ipcRenderer.on(IpcChannel.terminalExit, (_event, data: TerminalExitPayload) => {
  terminalDataBacklog.delete(data.id);
  const handler = terminalExitSubscribers.get(data.id);
  if (handler) {
    handler(data);
    return;
  }
  if (
    !terminalExitBacklog.has(data.id) &&
    terminalExitBacklog.size >= MAX_BUFFERED_TERMINAL_SESSIONS
  ) {
    const [oldestId] = terminalExitBacklog.keys();
    if (oldestId) {
      terminalExitBacklog.delete(oldestId);
    }
  }
  terminalExitBacklog.set(data.id, data);
});

let permissionRequestHandler:
  | ((request: PermissionRequestPayload) => void)
  | null = null;
ipcRenderer.on(IpcChannel.permissionRequest, (_event, request) => {
  permissionRequestHandler?.(request);
});

let permissionCancelledHandler: ((requestId: string) => void) | null = null;
ipcRenderer.on(IpcChannel.permissionCancelled, (_event, requestId: string) => {
  permissionCancelledHandler?.(requestId);
});

let requestSaveHandler: (() => void) | null = null;
ipcRenderer.on(IpcChannel.stateRequestSave, () => {
  requestSaveHandler?.();
});

let stateLoadedData: WindowMetadata[] | null = null;
let stateLoadedHandler: ((windows: WindowMetadata[]) => void) | null = null;
ipcRenderer.on(IpcChannel.stateLoaded, (_event, windows) => {
  if (stateLoadedHandler) {
    stateLoadedHandler(windows);
  } else {
    stateLoadedData = windows;
  }
});

let settingsLoadedData: Settings | null = null;
let settingsLoadedHandler: ((settings: Settings) => void) | null = null;
ipcRenderer.on(IpcChannel.settingsLoaded, (_event, settings) => {
  if (settingsLoadedHandler) {
    settingsLoadedHandler(settings);
  } else {
    settingsLoadedData = settings;
  }
});

contextBridge.exposeInMainWorld("electronAPI", {
  cancelArtifact: (generationId: string): Promise<ArtifactCancelResponse> =>
    ipcRenderer.invoke(IpcChannel.artifactCancel, generationId),

  clearTerminalEventBuffer: (id: string) => {
    terminalDataBacklog.delete(id);
    terminalExitBacklog.delete(id);
  },

  deleteTempFile: (filePath: string) =>
    ipcRenderer.invoke(IpcChannel.fsDeleteTempFile, filePath),

  deleteWorkspace: (name: string) =>
    ipcRenderer.invoke(IpcChannel.workspaceDelete, name),

  generateArtifact: (
    prompt: string,
    providerId: ArtifactProviderId
  ): Promise<ArtifactStartResponse> =>
    ipcRenderer.invoke(IpcChannel.artifactGenerate, { prompt, providerId }),

  listArtifactProviders: (): Promise<ArtifactProviderSummary[]> =>
    ipcRenderer.invoke(IpcChannel.artifactProviders),

  listWorkspaces: () => ipcRenderer.invoke(IpcChannel.workspaceList),

  loadWorkspace: (name: string) =>
    ipcRenderer.invoke(IpcChannel.workspaceLoad, name),

  openFile: () => ipcRenderer.invoke(IpcChannel.dialogOpenFile),

  respondToPermission: (requestId: string, granted: boolean) =>
    ipcRenderer.invoke(IpcChannel.command, {
      payload: { granted, requestId },
      type: "permission:respond",
    }),

  saveSettings: (settings: Settings) =>
    ipcRenderer.invoke(IpcChannel.command, {
      payload: { settings },
      type: "settings:save",
    }),

  saveStateResponse: (windows: WindowMetadata[]) =>
    ipcRenderer.invoke(IpcChannel.stateSaveResponse, windows),

  saveTempFile: (name: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke(IpcChannel.dialogSaveTempFile, { buffer, name }),

  saveWorkspace: (name: string, windows: WindowMetadata[]) =>
    ipcRenderer.invoke(IpcChannel.workspaceSave, { name, windows }),

  sendCommand: (command: IPCCommand) =>
    ipcRenderer.invoke(IpcChannel.command, command),

  setArtifactProgressHandler: (
    generationId: string,
    handler: (event: ArtifactProgressEvent) => void
  ): (() => void) => {
    artifactProgressSubscribers.set(generationId, handler);
    const backlog = artifactProgressBacklog.get(generationId);
    if (backlog) {
      artifactProgressBacklog.delete(generationId);
      for (const event of backlog) {
        handler(event);
      }
    }
    return () => {
      if (artifactProgressSubscribers.get(generationId) === handler) {
        artifactProgressSubscribers.delete(generationId);
      }
    };
  },

  setBlockedCountHandler: (
    origin: string,
    handler: (data: { count: number; origin: string }) => void
  ): (() => void) => {
    const handlers = blockedCountSubscribers.get(origin) ?? new Set();
    handlers.add(handler);
    blockedCountSubscribers.set(origin, handlers);
    return () => {
      const current = blockedCountSubscribers.get(origin);
      if (!current) {
        return;
      }
      current.delete(handler);
      if (current.size === 0) {
        blockedCountSubscribers.delete(origin);
      }
    };
  },

  setPermissionCancelledHandler: (handler: (requestId: string) => void) => {
    permissionCancelledHandler = handler;
  },

  setPermissionRequestHandler: (
    handler: (request: PermissionRequestPayload) => void
  ) => {
    permissionRequestHandler = handler;
  },

  setRequestSaveHandler: (handler: () => void) => {
    requestSaveHandler = handler;
  },

  setSettingsLoadedHandler: (handler: (settings: Settings) => void) => {
    settingsLoadedHandler = handler;
    if (settingsLoadedData !== null) {
      handler(settingsLoadedData);
      settingsLoadedData = null;
    }
  },

  setStateLoadedHandler: (handler: (windows: WindowMetadata[]) => void) => {
    stateLoadedHandler = handler;
    if (stateLoadedData) {
      handler(stateLoadedData);
      stateLoadedData = null;
    }
  },

  setTerminalDataHandler: (
    id: string,
    handler: (data: TerminalDataPayload) => void
  ): (() => void) => {
    terminalDataSubscribers.set(id, handler);
    const backlog = terminalDataBacklog.get(id);
    if (backlog) {
      terminalDataBacklog.delete(id);
      for (const data of backlog.events) {
        handler(data);
      }
    }
    return () => {
      if (terminalDataSubscribers.get(id) === handler) {
        terminalDataSubscribers.delete(id);
      }
    };
  },

  setTerminalExitHandler: (
    id: string,
    handler: (data: TerminalExitPayload) => void
  ): (() => void) => {
    terminalExitSubscribers.set(id, handler);
    const backlog = terminalExitBacklog.get(id);
    if (backlog) {
      terminalExitBacklog.delete(id);
      handler(backlog);
    }
    return () => {
      if (terminalExitSubscribers.get(id) === handler) {
        terminalExitSubscribers.delete(id);
      }
    };
  },

  stageFile: (filePath: string) =>
    ipcRenderer.invoke(IpcChannel.fsStageFile, filePath),

  terminalKill: (id: string) => ipcRenderer.invoke(IpcChannel.terminalKill, id),

  terminalResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke(IpcChannel.terminalResize, { cols, id, rows }),

  terminalSpawn: (
    options: TerminalSpawnOptions
  ): Promise<TerminalSpawnResult> =>
    ipcRenderer.invoke(IpcChannel.terminalSpawn, options),

  terminalWrite: (id: string, data: string) =>
    ipcRenderer.invoke(IpcChannel.terminalWrite, { data, id }),
});

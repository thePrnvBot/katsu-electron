import { contextBridge, ipcRenderer } from "electron";

import type {
  IPCCommand,
  PermissionRequestPayload,
  Settings,
  WindowMetadata,
} from "../shared/contract.js";
import { IpcChannel } from "../shared/ipc-channels.js";

const blockedCountSubscribers = new Map<
  string,
  (data: { count: number; origin: string }) => void
>();
ipcRenderer.on(IpcChannel.adblockCount, (_event, data) => {
  for (const handler of blockedCountSubscribers.values()) {
    handler(data);
  }
});

let permissionRequestHandler:
  | ((request: PermissionRequestPayload) => void)
  | null = null;
ipcRenderer.on(IpcChannel.permissionRequest, (_event, request) => {
  permissionRequestHandler?.(request);
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
  deleteTempFile: (filePath: string) =>
    ipcRenderer.invoke(IpcChannel.fsDeleteTempFile, filePath),

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

  sendCommand: (command: IPCCommand) =>
    ipcRenderer.invoke(IpcChannel.command, command),

  setBlockedCountHandler: (
    subscriberId: string,
    handler: (data: { count: number; origin: string }) => void
  ): (() => void) => {
    blockedCountSubscribers.set(subscriberId, handler);
    return () => {
      blockedCountSubscribers.delete(subscriberId);
    };
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

  stageFile: (filePath: string) =>
    ipcRenderer.invoke(IpcChannel.fsStageFile, filePath),
});

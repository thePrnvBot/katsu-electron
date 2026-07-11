import { contextBridge, ipcRenderer } from "electron";

let webviewPreloadPath = "";

ipcRenderer.once("config", (_event, config: { webviewPreloadPath: string }) => {
  ({ webviewPreloadPath } = config);
});

let _blockedCountHandler:
  | ((data: { count: number; origin: string }) => void)
  | null = null;
ipcRenderer.on("adblock:count", (_event, data) => {
  _blockedCountHandler?.(data);
});

let _eventHandler: ((event: unknown) => void) | null = null;
ipcRenderer.on("katsu:event", (_event, data) => {
  _eventHandler?.(data);
});

let _permissionRequestHandler:
  | ((request: {
      id: string;
      permission: string;
      origin: string;
      message: string;
    }) => void)
  | null = null;
ipcRenderer.on("permission:request", (_event, request) => {
  _permissionRequestHandler?.(request);
});

let _requestSaveHandler: (() => void) | null = null;
ipcRenderer.on("state:requestSave", () => {
  _requestSaveHandler?.();
});

let _stateLoadedData: unknown[] | null = null;
let _stateLoadedHandler: ((windows: unknown[]) => void) | null = null;
ipcRenderer.once("state:loaded", (_event, windows) => {
  if (_stateLoadedHandler) {
    _stateLoadedHandler(windows);
  } else {
    _stateLoadedData = windows;
  }
});

contextBridge.exposeInMainWorld("electronAPI", {
  getWebviewPreloadPath: () => webviewPreloadPath,

  openFile: () => ipcRenderer.invoke("dialog:openFile"),

  platform: process.platform,

  respondToPermission: (permissionId: string, granted: boolean) =>
    ipcRenderer.invoke(`permission:response:${permissionId}`, granted),

  saveState: (windows: unknown[]) =>
    ipcRenderer.invoke("katsu:command", {
      payload: { windows },
      type: "state:save",
    }),

  saveStateResponse: (windows: unknown[]) =>
    ipcRenderer.invoke("state:saveResponse", windows),

  saveTempFile: (name: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke("dialog:saveTempFile", { buffer, name }),

  sendCommand: (command: unknown) =>
    ipcRenderer.invoke("katsu:command", command),

  setBlockedCountHandler: (
    handler: (data: { count: number; origin: string }) => void
  ) => {
    _blockedCountHandler = handler;
  },

  setEventHandler: (handler: (event: unknown) => void) => {
    _eventHandler = handler;
  },

  setPermissionRequestHandler: (
    handler: (request: {
      id: string;
      permission: string;
      origin: string;
      message: string;
    }) => void
  ) => {
    _permissionRequestHandler = handler;
  },

  setRequestSaveHandler: (handler: () => void) => {
    _requestSaveHandler = handler;
  },

  setStateLoadedHandler: (handler: (windows: unknown[]) => void) => {
    _stateLoadedHandler = handler;
    if (_stateLoadedData) {
      handler(_stateLoadedData);
      _stateLoadedData = null;
    }
  },
});

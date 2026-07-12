import { contextBridge, ipcRenderer } from "electron";

let webviewPreloadPath = "";
let userAgent = "";

ipcRenderer.once(
  "config",
  (_event, config: { userAgent: string; webviewPreloadPath: string }) => {
    ({ webviewPreloadPath, userAgent } = config);
  }
);

const _blockedCountSubscribers = new Map<
  string,
  (data: { count: number; origin: string }) => void
>();
ipcRenderer.on("adblock:count", (_event, data) => {
  for (const handler of _blockedCountSubscribers.values()) {
    handler(data);
  }
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

let _settingsLoadedData: unknown | null = null;
let _settingsLoadedHandler: ((settings: unknown) => void) | null = null;
ipcRenderer.once("settings:loaded", (_event, settings) => {
  if (_settingsLoadedHandler) {
    _settingsLoadedHandler(settings);
  } else {
    _settingsLoadedData = settings;
  }
});

contextBridge.exposeInMainWorld("electronAPI", {
  getUserAgent: () => userAgent,
  getWebviewPreloadPath: () => webviewPreloadPath,

  loadSettings: () => ipcRenderer.invoke("settings:load"),

  openFile: () => ipcRenderer.invoke("dialog:openFile"),

  platform: process.platform,

  respondToPermission: (permissionId: string, granted: boolean) =>
    ipcRenderer.invoke(`permission:response:${permissionId}`, granted),

  saveSettings: (settings: unknown) =>
    ipcRenderer.invoke("katsu:command", {
      payload: { settings },
      type: "settings:save",
    }),

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
    subscriberId: string,
    handler: (data: { count: number; origin: string }) => void
  ): (() => void) => {
    _blockedCountSubscribers.set(subscriberId, handler);
    return () => {
      _blockedCountSubscribers.delete(subscriberId);
    };
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

  setSettingsLoadedHandler: (handler: (settings: unknown) => void) => {
    _settingsLoadedHandler = handler;
    if (_settingsLoadedData) {
      handler(_settingsLoadedData);
      _settingsLoadedData = null;
    }
  },

  setStateLoadedHandler: (handler: (windows: unknown[]) => void) => {
    _stateLoadedHandler = handler;
    if (_stateLoadedData) {
      handler(_stateLoadedData);
      _stateLoadedData = null;
    }
  },
});

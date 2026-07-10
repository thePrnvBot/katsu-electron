import { contextBridge, ipcRenderer } from "electron";

let webviewPreloadPath = "";

ipcRenderer.once("config", (_event, config: { webviewPreloadPath: string }) => {
  webviewPreloadPath = config.webviewPreloadPath;
});

contextBridge.exposeInMainWorld("electronAPI", {
  sendCommand: async (command: unknown) => {
    return ipcRenderer.invoke("katsu:command", command);
  },

  openFile: async () => {
    return ipcRenderer.invoke("dialog:openFile");
  },

  onStateLoaded: (callback: (windows: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, windows: unknown[]) =>
      callback(windows);
    ipcRenderer.once("state:loaded", handler);
    return () => ipcRenderer.removeListener("state:loaded", handler);
  },

  onEvent: (callback: (event: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) =>
      callback(data);
    ipcRenderer.on("katsu:event", handler);
    return () => ipcRenderer.removeListener("katsu:event", handler);
  },

  platform: process.platform,

  getWebviewPreloadPath: () => webviewPreloadPath,

  onBlockedCount: (callback: (count: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, count: number) =>
      callback(count);
    ipcRenderer.on("adblock:count", handler);
    return () => ipcRenderer.removeListener("adblock:count", handler);
  },

  onPermissionRequest: (
    callback: (request: {
      id: string;
      permission: string;
      origin: string;
      message: string;
    }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      request: {
        id: string;
        permission: string;
        origin: string;
        message: string;
      }
    ) => callback(request);
    ipcRenderer.on("permission:request", handler);
    return () => ipcRenderer.removeListener("permission:request", handler);
  },

  respondToPermission: async (permissionId: string, granted: boolean) => {
    return ipcRenderer.invoke(`permission:response:${permissionId}`, granted);
  },

  saveState: async (windows: unknown[]) => {
    return ipcRenderer.invoke("katsu:command", {
      type: "state:save",
      payload: { windows },
    });
  },

  onRequestSave: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("state:requestSave", handler);
    return () => ipcRenderer.removeListener("state:requestSave", handler);
  },

  saveStateResponse: async (windows: unknown[]) => {
    return ipcRenderer.invoke("state:saveResponse", windows);
  },

  saveTempFile: async (name: string, buffer: ArrayBuffer) => {
    return ipcRenderer.invoke("dialog:saveTempFile", { name, buffer });
  },
});

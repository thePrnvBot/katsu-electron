import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("katsuWebview", {
  postMessage: (message: unknown) => {
    ipcRenderer.sendToHost("webview:message", message);
  },
  onMessage: (callback: (message: unknown) => void) => {
    ipcRenderer.on("webview:message", (_event, message) => callback(message));
  },
  platform: process.platform,
  isKatsu: true,
});

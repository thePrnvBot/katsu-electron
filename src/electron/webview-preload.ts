import { contextBridge, ipcRenderer } from "electron";

let _messageHandler: ((message: unknown) => void) | null = null;
ipcRenderer.on("webview:message", (_event, message) => {
  _messageHandler?.(message);
});

contextBridge.exposeInMainWorld("katsuWebview", {
  isKatsu: true,
  platform: process.platform,
  postMessage: (message: unknown) => {
    ipcRenderer.sendToHost("webview:message", message);
  },
  setMessageHandler: (handler: (message: unknown) => void) => {
    _messageHandler = handler;
  },
});

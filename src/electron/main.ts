import path from "node:path";

import * as Effect from "effect/Effect";
import { app, BrowserWindow } from "electron";

import { registerIpcHandlers } from "./ipc/handlers.js";
import { MainLayer } from "./layers/main-layer.js";
import { AdBlocker } from "./services/ad-blocker.js";
import { IPCRouter } from "./services/ipc-router.js";
import {
  cleanUserAgent,
  sendInitialState,
  setupAdBlocking,
  setupDefaultProtocol,
  setupKatsuSession,
  setupWebContentsListeners,
} from "./session/setup.js";
import { isDev } from "./util.js";
import { getMainWindow, setMainWindow } from "./window-manager.js";

let isQuitting = false;

app.userAgentFallback = cleanUserAgent;

app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

setupWebContentsListeners();

app.on("ready", async () => {
  // Initialize ad blocker before creating window
  await Effect.runPromise(
    Effect.gen(function* loadAdBlocker() {
      const adBlocker = yield* AdBlocker;
      return yield* adBlocker.init;
    }).pipe(Effect.provide(MainLayer))
  ).catch(() =>
    console.warn("Ad blocker failed to initialize, continuing without it")
  );

  // Initialize window:control handler in the IPC router
  Effect.runSync(
    Effect.gen(function* initRouter() {
      const router = yield* IPCRouter;
      return yield* router.registerHandler("window:control", (payload) =>
        Effect.sync(() => {
          const action = payload as string;
          const win = getMainWindow();
          if (!win) {
            return;
          }
          if (action === "close") {
            win.close();
          } else if (action === "minimize") {
            win.minimize();
          } else if (action === "maximize") {
            if (win.isMaximized()) {
              win.unmaximize();
            } else {
              win.maximize();
            }
          }
        })
      );
    }).pipe(Effect.provide(MainLayer))
  );

  registerIpcHandlers();
  setupDefaultProtocol();

  const mainWindow = new BrowserWindow({
    frame: false,
    height: 900,
    titleBarStyle: "hidden",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), "dist-electron", "preload.js"),
      sandbox: false,
      webviewTag: true,
    },
    width: 1400,
  });

  setMainWindow(mainWindow);

  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(
      path.join(app.getAppPath(), "dist-react", "index.html")
    );
  }

  const katsuSession = setupKatsuSession();
  setupAdBlocking(katsuSession);

  mainWindow.webContents.once("did-finish-load", sendInitialState);

  mainWindow.on("closed", () => {
    setMainWindow(null);
  });
});

app.on("before-quit", async () => {
  if (isQuitting) {
    return;
  }
  isQuitting = true;

  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send("state:requestSave");
    await Effect.runPromise(Effect.sleep("500 millis"));
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

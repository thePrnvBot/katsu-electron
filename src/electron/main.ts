/** Electron entry: single-instance lock, privileged scheme registration, main window lifecycle. */

import path from "node:path";

import * as Effect from "effect/Effect";
import { app, BrowserWindow, protocol, webContents } from "electron";

import type { WindowControlAction } from "../shared/contract.js";
import { registerIpcHandlers } from "./ipc/handlers.js";
import { beginSaveAndQuit, quitInProgress } from "./quit-flow.js";
import { mainRuntime } from "./runtime.js";
import { WindowControlPayloadSchema } from "./schemas/ipc-schemas.js";
import { AdBlocker } from "./services/ad-blocker.js";
import { decodeCommandPayload, IPCRouter } from "./services/ipc-router.js";
import {
  cleanUserAgent,
  sendInitialState,
  setupAdBlocking,
  setupDefaultProtocol,
  setupKatsuSession,
  setupWebContentsListeners,
} from "./session/setup.js";
import { cleanDropsDir, isDev } from "./util.js";
import { getMainWindow, setMainWindow } from "./window-manager.js";

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

// katsu:// is our own scheme: mark it standard/secure/stream-capable BEFORE
// the app is ready so the protocol handler can stream preview media.
protocol.registerSchemesAsPrivileged([
  {
    privileges: {
      bypassCSP: false,
      corsEnabled: true,
      secure: true,
      standard: true,
      stream: true,
      supportFetchAPI: true,
    },
    scheme: "katsu",
  },
]);

app.userAgentFallback = cleanUserAgent;

if (hasSingleInstanceLock) {
  app.on("second-instance", () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) {
      return;
    }
    if (win.isMinimized()) {
      win.restore();
    }
    win.focus();
  });
}

// NOTE: `disable-renderer-backgrounding` / `disable-background-timer-throttling`
// / `disable-backgrounding-occluded-windows` are deliberately NOT set — on
// Windows they route hidden-window rendering through Chromium's
// `disable_hidden` patch path, which evicts hidden webview compositor frames
// (electron/electron#42378): webviews go blank after windowed resize and
// minimize/restore.

// Chromium's Windows occlusion tracker races the restore animation: a
// minimized/restored window can be marked occluded and keep serving a blank
// compositor frame. webContents.invalidate() alone did not help in
// electron/electron#42378 — the feature itself must be off.
if (process.platform === "win32") {
  app.commandLine.appendSwitch(
    "disable-features",
    "CalculateNativeWinOcclusion"
  );
}

if (hasSingleInstanceLock) {
  setupWebContentsListeners();
}

const WINDOW_ACTIONS = {
  close: (win) => win.close(),
  maximize: (win) => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  },
  minimize: (win) => win.minimize(),
} satisfies Record<WindowControlAction, (win: BrowserWindow) => void>;

const registerWindowControlHandler = (): void => {
  mainRuntime.runSync(
    Effect.gen(function* registerWindowControl() {
      const router = yield* IPCRouter;
      yield* router.register("window:control", (payload) =>
        Effect.gen(function* windowControl() {
          const action: WindowControlAction = yield* decodeCommandPayload(
            WindowControlPayloadSchema,
            payload,
            "window:control"
          );
          const win = getMainWindow();
          if (win) {
            WINDOW_ACTIONS[action](win);
          }
          return { done: action };
        })
      );
    })
  );
};

const initAdBlockerLazy = (): void => {
  void mainRuntime
    .runPromise(
      Effect.gen(function* loadAdBlocker() {
        const adBlocker = yield* AdBlocker;
        // Single-flight in the service — repeat calls just await readiness.
        yield* adBlocker.init;
      })
    )
    .catch((error) => {
      console.warn(
        "Ad blocker failed to initialize, continuing without it",
        error
      );
    });
};

app.on("ready", async () => {
  if (!hasSingleInstanceLock) {
    return;
  }

  // Wipe preview drops orphaned by a previous run before anything can serve them.
  await mainRuntime.runPromise(cleanDropsDir());

  registerIpcHandlers();
  registerWindowControlHandler();
  setupDefaultProtocol();

  const mainWindow = new BrowserWindow({
    frame: false,
    height: 900,
    titleBarStyle: "hidden",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(
        app.getAppPath(),
        "dist-electron",
        "electron",
        "preload.js"
      ),
      sandbox: false,
      webviewTag: true,
    },
    width: 1400,
  });

  setMainWindow(mainWindow);

  // Grid cells are sized from the viewport when the renderer loads, so start
  // maximized — the default cell size is the monitor work area rather than
  // the launch window, and no manual "Refresh Grid Size" is needed.
  mainWindow.maximize();

  const loadPromise = isDev()
    ? mainWindow.loadURL("http://localhost:5123")
    : mainWindow.loadFile(
        path.join(app.getAppPath(), "dist-react", "index.html")
      );
  void loadPromise.catch(() => {
    console.error("Failed to load renderer");
  });

  const katsuSession = setupKatsuSession();
  setupAdBlocking(katsuSession);

  // Send state on EVERY finished load so dev HMR/full reloads re-hydrate.
  mainWindow.webContents.on("did-finish-load", () => {
    void sendInitialState();
    // Defer ad-blocker init until after first paint — it must not block
    // window creation. Requests fail open until the engine is ready; the
    // service makes repeat calls (dev reloads) single-flight no-ops.
    initAdBlockerLazy();
  });

  // Belt and suspenders: if the compositor still served stale/blank frames
  // (occlusion race), a restore forces a full frame regeneration.
  //
  // Webview guests need this explicitly — the host's invalidate recovers
  // the DOM, but guest compositor surfaces that were hidden during minimize
  // stay blank until the guest itself is told to re-emit a frame.
  mainWindow.on("restore", () => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) {
        contents.invalidate();
      }
    }
  });

  // Intercept the close BEFORE the window is destroyed: `closed` would null
  // the window first and `before-quit` fires too late to ask for state.
  mainWindow.on("close", (event) => {
    if (quitInProgress()) {
      return;
    }
    event.preventDefault();
    beginSaveAndQuit();
  });

  mainWindow.on("closed", () => {
    setMainWindow(null);
  });
});

app.on("before-quit", (event) => {
  if (!hasSingleInstanceLock) {
    return;
  }
  if (quitInProgress()) {
    return;
  }
  event.preventDefault();
  beginSaveAndQuit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import * as Effect from "effect/Effect";
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  session,
} from "electron";

import { MainLayer } from "./layers/main-layer.js";
import { AdBlocker } from "./services/ad-blocker.js";
import { IPCRouter } from "./services/ipc-router.js";
import { Persistence } from "./services/persistence.js";
import { ProtocolHandler } from "./services/protocol-handler.js";
import type { WindowMetadata } from "./shared/types.js";
import { isDev } from "./util.js";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

const chromeVersion = process.versions.chrome;
const cleanUserAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

app.userAgentFallback = cleanUserAgent;

app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

app.on("web-contents-created", (_event, contents) => {
  contents.on("did-navigate", (_navEvent, url) => {
    try {
      const { origin } = new URL(url);
      Effect.runSync(
        Effect.gen(function* resetBlockedCount() {
          const adBlocker = yield* AdBlocker;
          return yield* adBlocker.resetBlockedCountForOrigin(origin);
        }).pipe(Effect.provide(MainLayer))
      );
      mainWindow?.webContents.send("adblock:count", { count: 0, origin });
    } catch {
      // invalid URL, ignore
    }
  });
});

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

  mainWindow = new BrowserWindow({
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

  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(
      path.join(app.getAppPath(), "dist-react", "index.html")
    );
  }

  // Register katsu:// protocol on default session
  protocol.handle("katsu", (request: { url: string }) => {
    const program = Effect.gen(function* program() {
      const handler = yield* ProtocolHandler;
      return yield* handler.handleRequest(request.url);
    });

    return Effect.runPromise(program.pipe(Effect.provide(MainLayer)));
  });

  // Register katsu:// protocol on webview partition session
  const katsuSession = session.fromPartition("persist:katsu");

  katsuSession.setUserAgent(cleanUserAgent);

  katsuSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === "media") {
      callback(true);
      return;
    }
    callback(false);
  });

  katsuSession.setPermissionCheckHandler(() => true);

  katsuSession.webRequest.onBeforeSendHeaders(
    { urls: ["<all_urls>"] },
    (details, callback) => {
      const ua =
        details.requestHeaders["User-Agent"] ||
        details.requestHeaders["user-agent"];
      if (ua) {
        details.requestHeaders["User-Agent"] = cleanUserAgent;
        details.requestHeaders["user-agent"] = cleanUserAgent;
      }
      details.requestHeaders["sec-ch-ua"] =
        `"Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}", "Not.A/Brand";v="99"`;
      details.requestHeaders["sec-ch-ua-mobile"] = "?0";
      details.requestHeaders["sec-ch-ua-platform"] = `"Windows"`;
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  );

  katsuSession.protocol.handle("katsu", (request: { url: string }) => {
    const program = Effect.gen(function* program() {
      const handler = yield* ProtocolHandler;
      return yield* handler.handleRequest(request.url);
    });

    return Effect.runPromise(program.pipe(Effect.provide(MainLayer)));
  });

  // Ad blocking interceptor on webview session
  const evaluateBlocking = async (
    details: Electron.OnBeforeRequestListenerDetails
  ): Promise<{ cancel: boolean }> => {
    const originURL = details.frame?.url || details.referrer || "";

    const blocked = await Effect.runPromise(
      Effect.gen(function* blocked() {
        const adBlocker = yield* AdBlocker;
        return yield* adBlocker.matchRequest({
          method: details.method,
          originURL,
          type: details.resourceType,
          url: details.url,
        });
      }).pipe(Effect.provide(MainLayer))
    );

    if (blocked) {
      try {
        const { origin } = new URL(originURL);
        const count = await Effect.runPromise(
          Effect.gen(function* count() {
            const adBlocker = yield* AdBlocker;
            return yield* adBlocker.getBlockedCountForOrigin(origin);
          }).pipe(Effect.provide(MainLayer))
        );
        mainWindow?.webContents.send("adblock:count", {
          count,
          origin,
        });
      } catch {
        /* intentionally ignored */
      }
    }

    return { cancel: blocked };
  };

  katsuSession.webRequest.onBeforeRequest(
    { urls: ["<all_urls>"] },
    (details, callback) => {
      evaluateBlocking(details)
        .then((result) => callback(result))
        .catch(() => callback({ cancel: false }));
    }
  );

  // Register window:control handler
  Effect.runSync(
    Effect.gen(function* initRouter() {
      const router = yield* IPCRouter;
      return yield* router.registerHandler("window:control", (payload) =>
        Effect.sync(() => {
          const action = payload as string;
          if (!mainWindow) {
            return;
          }
          if (action === "close") {
            mainWindow.close();
          } else if (action === "minimize") {
            mainWindow.minimize();
          } else if (action === "maximize") {
            if (mainWindow.isMaximized()) {
              mainWindow.unmaximize();
            } else {
              mainWindow.maximize();
            }
          }
        })
      );
    }).pipe(Effect.provide(MainLayer))
  );

  // IPC handler
  ipcMain.handle("katsu:command", async (_event, command: unknown) => {
    const program = Effect.gen(function* program() {
      const router = yield* IPCRouter;
      return yield* router.handleCommand(command);
    });

    try {
      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MainLayer))
      );
      return { data: result, success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: message, success: false };
    }
  });

  // Handle dialog:openFile
  ipcMain.handle("dialog:openFile", async () => {
    if (!mainWindow) {
      return { canceled: true, filePaths: [] };
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
    });
    return { canceled: result.canceled, filePaths: result.filePaths };
  });

  // Handle dialog:saveTempFile
  ipcMain.handle(
    "dialog:saveTempFile",
    async (_event, args: { name: string; buffer: ArrayBuffer }) => {
      const dir = path.join(app.getPath("temp"), "katsu-drops");
      await fs.mkdir(dir, { recursive: true });
      const id = crypto.randomUUID();
      const filePath = path.join(dir, `${id}-${args.name}`);
      const buffer = Buffer.from(args.buffer);
      await fs.writeFile(filePath, buffer);
      return filePath;
    }
  );

  // Handle settings:load
  ipcMain.handle("settings:load", async () => {
    const settingsPath = path.join(app.getPath("userData"), "settings.json");
    try {
      const content = await fs.readFile(settingsPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return { windowPeeking: false };
    }
  });

  // Send config and saved state after renderer loads
  mainWindow.webContents.once("did-finish-load", async () => {
    mainWindow?.webContents.send("config", {
      userAgent: cleanUserAgent,
      webviewPreloadPath: path.join(
        app.getAppPath(),
        "dist-electron",
        "webview-preload.js"
      ),
    });

    const program = Effect.gen(function* program() {
      const persistence = yield* Persistence;
      return yield* persistence.loadState;
    });

    try {
      const savedWindows = await Effect.runPromise(
        program.pipe(Effect.provide(MainLayer))
      );
      mainWindow?.webContents.send("state:loaded", savedWindows);
    } catch {
      mainWindow?.webContents.send("state:loaded", []);
    }

    // Load and send settings
    const settingsPath = path.join(app.getPath("userData"), "settings.json");
    try {
      const content = await fs.readFile(settingsPath, "utf-8");
      mainWindow?.webContents.send("settings:loaded", JSON.parse(content));
    } catch {
      mainWindow?.webContents.send("settings:loaded", {
        windowPeeking: false,
      });
    }
  });

  // Handle state save response from renderer
  ipcMain.handle(
    "state:saveResponse",
    async (_event, windows: WindowMetadata[]) => {
      if (!windows || windows.length === 0) {
        return;
      }

      const program = Effect.gen(function* program() {
        const persistence = yield* Persistence;
        return yield* persistence.saveState(windows);
      });

      try {
        await Effect.runPromise(program.pipe(Effect.provide(MainLayer)));
      } catch (error) {
        console.error("Failed to save state on quit:", error);
      }
    }
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
});

app.on("before-quit", async () => {
  if (isQuitting) {
    return;
  }
  isQuitting = true;

  // Request renderer to save its current state
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("state:requestSave");

    // Give renderer a moment to respond with state
    await Effect.runPromise(Effect.sleep("500 millis"));
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

import { app, BrowserWindow, ipcMain, dialog, protocol, session } from "electron";
import * as Effect from "effect/Effect";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { isDev } from "./util.js";
import { MainLayer } from "./layers/MainLayer.js";
import { IPCRouter } from "./services/IPCRouter.js";
import { Persistence } from "./services/Persistence.js";
import { ProtocolHandler } from "./services/ProtocolHandler.js";
import { AdBlocker } from "./services/AdBlocker.js";
import type { WindowMetadata } from "./shared/types.js";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

app.on("web-contents-created", (_event, contents) => {
  contents.on("did-navigate", () => {
    Effect.runSync(
      Effect.gen(function* () {
        const adBlocker = yield* AdBlocker;
        return yield* adBlocker.resetBlockedCount;
      }).pipe(Effect.provide(MainLayer))
    );
    mainWindow?.webContents.send("adblock:count", 0);
  });
});

app.on("ready", async () => {
  // Initialize ad blocker before creating window
  await Effect.runPromise(
    Effect.gen(function* () {
      const adBlocker = yield* AdBlocker;
      return yield* adBlocker.init;
    }).pipe(Effect.provide(MainLayer))
  ).catch(() => console.warn("Ad blocker failed to initialize, continuing without it"));

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(app.getAppPath(), "dist-electron", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
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
    const program = Effect.gen(function* () {
      const handler = yield* ProtocolHandler;
      return yield* handler.handleRequest(request.url);
    });

    return Effect.runPromise(
      program.pipe(Effect.provide(MainLayer))
    );
  });

  // Register katsu:// protocol on webview partition session
  const katsuSession = session.fromPartition("persist:katsu");
  katsuSession.protocol.handle("katsu", (request: { url: string }) => {
    const program = Effect.gen(function* () {
      const handler = yield* ProtocolHandler;
      return yield* handler.handleRequest(request.url);
    });

    return Effect.runPromise(
      program.pipe(Effect.provide(MainLayer))
    );
  });

  // Ad blocking interceptor on webview session
  let blockedCountSent = 0;
  katsuSession.webRequest.onBeforeRequest(
    { urls: ["<all_urls>"] },
    (details, callback) => {
      const originURL = details.frame?.url || details.referrer || "";

      const program = Effect.gen(function* () {
        const adBlocker = yield* AdBlocker;
        return yield* adBlocker.matchRequest({
          url: details.url,
          originURL,
          type: details.resourceType,
          method: details.method,
        });
      });

      Effect.runPromise(program.pipe(Effect.provide(MainLayer)))
        .then((blocked) => {
          callback({ cancel: blocked });
          if (blocked) {
            Effect.runPromise(
              Effect.gen(function* () {
                const adBlocker = yield* AdBlocker;
                return yield* adBlocker.getBlockedCount;
              }).pipe(Effect.provide(MainLayer))
            ).then((count) => {
              if (count !== blockedCountSent) {
                blockedCountSent = count;
                mainWindow?.webContents.send("adblock:count", count);
              }
            }).catch(() => {});
          }
        })
        .catch(() => callback({ cancel: false }));
    }
  );

  // Register window:control handler
  Effect.runSync(
    Effect.gen(function* () {
      const router = yield* IPCRouter;
      return yield* router.registerHandler("window:control", (payload) =>
        Effect.sync(() => {
          const action = payload as string;
          if (!mainWindow) return;
          if (action === "close") mainWindow.close();
          else if (action === "minimize") mainWindow.minimize();
          else if (action === "maximize") {
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
    const program = Effect.gen(function* () {
      const router = yield* IPCRouter;
      return yield* router.handleCommand(command);
    });

    try {
      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MainLayer))
      );
      return { success: true, data: result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // Handle dialog:openFile
  ipcMain.handle("dialog:openFile", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile", "multiSelections"],
    });
    return { canceled: result.canceled, filePaths: result.filePaths };
  });

  // Handle dialog:saveTempFile
  ipcMain.handle("dialog:saveTempFile", async (_event, args: { name: string; buffer: ArrayBuffer }) => {
    const dir = path.join(app.getPath("temp"), "katsu-drops");
    await fs.mkdir(dir, { recursive: true });
    const id = crypto.randomUUID();
    const filePath = path.join(dir, `${id}-${args.name}`);
    const buffer = Buffer.from(args.buffer);
    await fs.writeFile(filePath, buffer);
    return filePath;
  });

  // Send config and saved state after renderer loads
  mainWindow.webContents.once("did-finish-load", async () => {
    mainWindow?.webContents.send("config", {
      webviewPreloadPath: path.join(app.getAppPath(), "dist-electron", "webview-preload.js"),
    });

    const program = Effect.gen(function* () {
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
  });

  // Handle state save response from renderer
  ipcMain.handle("state:saveResponse", async (_event, windows: WindowMetadata[]) => {
    if (!windows || windows.length === 0) return;

    const program = Effect.gen(function* () {
      const persistence = yield* Persistence;
      return yield* persistence.saveState(windows);
    });

    try {
      await Effect.runPromise(program.pipe(Effect.provide(MainLayer)));
    } catch (err) {
      console.error("Failed to save state on quit:", err);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
});

app.on("before-quit", async () => {
  if (isQuitting) return;
  isQuitting = true;

  // Request renderer to save its current state
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("state:requestSave");

    // Give renderer a moment to respond with state
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

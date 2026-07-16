import path from "node:path";

import * as Effect from "effect/Effect";
import { app, protocol, session } from "electron";
import type { BrowserWindow } from "electron";

import { MainLayer } from "../layers/main-layer.js";
import { AdBlocker } from "../services/ad-blocker.js";
import { Persistence } from "../services/persistence.js";
import { ProtocolHandler } from "../services/protocol-handler.js";
import { getMainWindow } from "../window-manager.js";

const chromeVersion = process.versions.chrome;
export const cleanUserAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

export const setupKatsuSession = (): Electron.Session => {
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

  // Register katsu:// protocol on webview session
  katsuSession.protocol.handle("katsu", (request: { url: string }) => {
    const program = Effect.gen(function* program() {
      const handler = yield* ProtocolHandler;
      return yield* handler.handleRequest(request.url);
    });
    return Effect.runPromise(program.pipe(Effect.provide(MainLayer)));
  });

  return katsuSession;
};

export const setupDefaultProtocol = (): void => {
  protocol.handle("katsu", (request: { url: string }) => {
    const program = Effect.gen(function* program() {
      const handler = yield* ProtocolHandler;
      return yield* handler.handleRequest(request.url);
    });
    return Effect.runPromise(program.pipe(Effect.provide(MainLayer)));
  });
};

export const setupAdBlocking = (katsuSession: Electron.Session): void => {
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
        getMainWindow()?.webContents.send("adblock:count", {
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
};

export const setupWebContentsListeners = (): void => {
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
        getMainWindow()?.webContents.send("adblock:count", {
          count: 0,
          origin,
        });
      } catch {
        // invalid URL, ignore
      }
    });
  });
};

const sendOrDefault = async <T>(
  win: BrowserWindow,
  channel: string,
  loader: () => Promise<T>,
  fallback: T
): Promise<void> => {
  try {
    win.webContents.send(channel, await loader());
  } catch {
    win.webContents.send(channel, fallback);
  }
};

export const sendInitialState = async (): Promise<void> => {
  const win = getMainWindow();
  if (!win) {
    return;
  }

  win.webContents.send("config", {
    userAgent: cleanUserAgent,
    webviewPreloadPath: path.join(
      app.getAppPath(),
      "dist-electron",
      "webview-preload.js"
    ),
  });

  await sendOrDefault(
    win,
    "state:loaded",
    () =>
      Effect.runPromise(
        Effect.gen(function* program() {
          const persistence = yield* Persistence;
          return yield* persistence.loadState;
        }).pipe(Effect.provide(MainLayer))
      ),
    []
  );

  await sendOrDefault(
    win,
    "settings:loaded",
    () =>
      Effect.runPromise(
        Effect.tryPromise({
          catch: () => new Error("read failed"),
          try: () =>
            import("node:fs/promises").then((fs) =>
              fs.readFile(
                path.join(app.getPath("userData"), "settings.json"),
                "utf-8"
              )
            ),
        }).pipe(Effect.provide(MainLayer))
      ).then((content) => JSON.parse(content)),
    { windowPeeking: false }
  );
};

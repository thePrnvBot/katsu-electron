import * as Effect from "effect/Effect";
import { app, protocol, session, shell } from "electron";
import type { BrowserWindow } from "electron";

import { DEFAULT_SETTINGS } from "../../shared/contract.js";
import { IpcChannel } from "../../shared/ipc-channels.js";
import { mainRuntime } from "../runtime.js";
import { AdBlocker, originFromUrl } from "../services/ad-blocker.js";
import { Permissions } from "../services/permissions.js";
import { Persistence } from "../services/persistence.js";
import {
  ProtocolHandler,
  protocolErrorResponse,
} from "../services/protocol-handler.js";
import { isDev } from "../util.js";
import { getMainWindow } from "../window-manager.js";

const chromeVersion = process.versions.chrome;
export const cleanUserAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

const DEV_ORIGIN = "http://localhost:5123";

/** Single katsu:// handler shared by the default and webview sessions. */
const handleKatsuRequest = (request: Request): Promise<Response> =>
  mainRuntime
    .runPromise(
      Effect.gen(function* program() {
        const handler = yield* ProtocolHandler;
        return yield* handler.handleRequest(request);
      }).pipe(
        Effect.catchAll((error) => Effect.succeed(protocolErrorResponse(error)))
      )
    )
    .catch(() => new Response("Internal error", { status: 500 }));

const mediaPermissionMessage = (
  mediaTypes: readonly string[] | undefined
): string => {
  const wantsVideo = !mediaTypes || mediaTypes.includes("video");
  const wantsAudio = !mediaTypes || mediaTypes.includes("audio");
  if (wantsVideo && wantsAudio) {
    return "Allow this site to use your camera and microphone?";
  }
  if (wantsVideo) {
    return "Allow this site to use your camera?";
  }
  return "Allow this site to use your microphone?";
};

export const setupKatsuSession = (): Electron.Session => {
  const katsuSession = session.fromPartition("persist:katsu");

  katsuSession.setUserAgent(cleanUserAgent);

  // Deny by default; `media` is gated behind the renderer permission dialog.
  katsuSession.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      if (permission !== "media" || !details.isMainFrame) {
        callback(false);
        return;
      }
      const mediaTypes =
        "mediaTypes" in details ? details.mediaTypes : undefined;
      const securityOrigin =
        "securityOrigin" in details ? details.securityOrigin : undefined;
      const origin =
        originFromUrl(details.requestingUrl ?? "") ?? "unknown origin";
      mainRuntime
        .runPromise(
          Effect.gen(function* program() {
            const permissions = yield* Permissions;
            return yield* permissions.requestPermission({
              message: mediaPermissionMessage(mediaTypes),
              origin,
              permission,
              securityOrigin,
            });
          })
        )
        .then(callback)
        .catch(() => callback(false));
    }
  );

  // Permission *checks* only pass for permissions previously granted by the user.
  katsuSession.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin, details) =>
      mainRuntime.runSync(
        Effect.gen(function* program() {
          const permissions = yield* Permissions;
          const securityOrigin =
            "securityOrigin" in details ? details.securityOrigin : undefined;
          const origins = securityOrigin
            ? [requestingOrigin, securityOrigin]
            : [requestingOrigin];
          return permissions.wasGrantedForOrigins(origins, permission);
        })
      )
  );

  katsuSession.webRequest.onBeforeSendHeaders(
    { urls: ["<all_urls>"] },
    (details, callback) => {
      const requestHeaders: Record<string, string> = {};
      // Copy all headers except User-Agent variants (case-insensitive).
      for (const [key, value] of Object.entries(details.requestHeaders)) {
        if (key.toLowerCase() !== "user-agent") {
          requestHeaders[key] = value;
        }
      }
      requestHeaders["User-Agent"] = cleanUserAgent;
      requestHeaders["sec-ch-ua"] =
        `"Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}", "Not.A/Brand";v="99"`;
      requestHeaders["sec-ch-ua-mobile"] = "?0";
      requestHeaders["sec-ch-ua-platform"] = `"Windows"`;
      callback({ cancel: false, requestHeaders });
    }
  );

  katsuSession.protocol.handle("katsu", handleKatsuRequest);

  return katsuSession;
};

export const setupDefaultProtocol = (): void => {
  protocol.handle("katsu", handleKatsuRequest);
};

const evaluateBlocking = async (
  details: Electron.OnBeforeRequestListenerDetails
): Promise<{ cancel: boolean }> => {
  const originURL = details.frame?.url || details.referrer || "";

  const outcome = await mainRuntime.runPromise(
    Effect.gen(function* blocking() {
      const adBlocker = yield* AdBlocker;
      const blocked = yield* adBlocker.matchRequest({
        method: details.method,
        originURL,
        type: details.resourceType,
        url: details.url,
      });
      const origin = blocked ? originFromUrl(originURL) : null;
      const count = origin
        ? yield* adBlocker.getBlockedCountForOrigin(origin)
        : 0;
      return { blocked, count, origin };
    })
  );

  if (outcome.blocked && outcome.origin) {
    getMainWindow()?.webContents.send(IpcChannel.adblockCount, {
      count: outcome.count,
      origin: outcome.origin,
    });
  }

  return { cancel: outcome.blocked };
};

export const setupAdBlocking = (katsuSession: Electron.Session): void => {
  katsuSession.webRequest.onBeforeRequest(
    { urls: ["<all_urls>"] },
    (details, callback) => {
      evaluateBlocking(details)
        .then((result) => callback(result))
        .catch(() => callback({ cancel: false }));
    }
  );
};

const isAllowedMainWindowUrl = (url: string): boolean => {
  if (isDev()) {
    return url.startsWith(DEV_ORIGIN);
  }
  return url.startsWith("file:");
};

export const setupWebContentsListeners = (): void => {
  app.on("web-contents-created", (_event, contents) => {
    // No new native windows from any guest — open real links externally.
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https://") || url.startsWith("http://")) {
        void shell.openExternal(url);
      }
      return { action: "deny" };
    });

    if (contents.getType() === "window") {
      // Pin webview preferences regardless of what the renderer asked for.
      contents.on("will-attach-webview", (_attachEvent, webPreferences) => {
        webPreferences.nodeIntegration = false;
        webPreferences.contextIsolation = true;
        webPreferences.sandbox = true;
        webPreferences.webSecurity = true;
        delete webPreferences.preload;
      });

      // The main window may only ever show the app itself.
      contents.on("will-navigate", (navEvent, url) => {
        if (!isAllowedMainWindowUrl(url)) {
          navEvent.preventDefault();
        }
      });
    }

    contents.on("did-navigate", (_navEvent, url) => {
      const origin = originFromUrl(url);
      if (!origin) {
        return;
      }
      mainRuntime.runSync(
        Effect.gen(function* resetBlockedCount() {
          const adBlocker = yield* AdBlocker;
          return yield* adBlocker.resetBlockedCountForOrigin(origin);
        })
      );
      getMainWindow()?.webContents.send(IpcChannel.adblockCount, {
        count: 0,
        origin,
      });
    });
  });
};

const sendOrDefault = async <T>(
  win: BrowserWindow,
  channel: IpcChannel,
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
  if (!win || win.isDestroyed()) {
    return;
  }

  await sendOrDefault(
    win,
    IpcChannel.stateLoaded,
    () =>
      mainRuntime.runPromise(
        Effect.gen(function* program() {
          const persistence = yield* Persistence;
          return yield* persistence.loadState;
        })
      ),
    []
  );

  await sendOrDefault(
    win,
    IpcChannel.settingsLoaded,
    () =>
      mainRuntime.runPromise(
        Effect.gen(function* program() {
          const persistence = yield* Persistence;
          return yield* persistence.loadSettings;
        })
      ),
    DEFAULT_SETTINGS
  );
};

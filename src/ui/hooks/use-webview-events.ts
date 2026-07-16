import { useEffect, useState } from "react";

import { useMediaResize } from "../components/preview/use-media-resize";
import { useWindowStore } from "../store/window-store";

export const useWebviewEvents = (
  windowId: string,
  webviewRef: React.RefObject<Electron.WebviewTag | null>
): string | null => {
  const [loadError, setLoadError] = useState<string | null>(null);
  const resizeMedia = useMediaResize(windowId);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }

    const { updateWindow } = useWindowStore.getState();

    const handleTitle = (e: { title: string }) => {
      updateWindow(windowId, { fileName: e.title });
    };

    const handleError = (e: {
      isMainFrame: boolean;
      errorCode: number;
      errorDescription: string;
    }) => {
      if (!e.isMainFrame) {
        return;
      }
      setLoadError(e.errorDescription || `Error ${e.errorCode}`);
    };

    const handleDidStartLoading = () => {
      setLoadError(null);
    };

    const handleWebviewMessage = (e: { channel: string; args: unknown[] }) => {
      if (e.channel !== "webview:message") {
        return;
      }
      const msg = e.args[0] as
        | { type?: string; w?: number; h?: number }
        | undefined;
      if (!msg || msg.type !== "media-dimensions" || !msg.w || !msg.h) {
        return;
      }
      resizeMedia(msg.w, msg.h);
    };

    webview.addEventListener("page-title-updated", handleTitle);
    webview.addEventListener("did-fail-load", handleError);
    webview.addEventListener("did-start-loading", handleDidStartLoading);
    webview.addEventListener("ipc-message", handleWebviewMessage);

    return () => {
      webview.removeEventListener("page-title-updated", handleTitle);
      webview.removeEventListener("did-fail-load", handleError);
      webview.removeEventListener("did-start-loading", handleDidStartLoading);
      webview.removeEventListener("ipc-message", handleWebviewMessage);
    };
  }, [windowId, webviewRef, resizeMedia]);

  return loadError;
};

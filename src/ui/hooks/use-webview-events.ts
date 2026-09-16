/** Webview listener wiring: page titles and load errors. */

import { useCallback, useEffect, useRef, useState } from "react";

import { useWindowStore } from "../store/window-store";

interface UseWebviewEventsResult {
  loadError: string | null;
  retry: () => void;
  /** Callback ref: listeners attach the moment the element mounts. */
  webviewRef: (element: Electron.WebviewTag | null) => void;
}

/**
 * Attaches webview listeners via callback ref (not an effect), so listeners
 * are in place before navigation starts and re-attach automatically when the
 * element remounts (e.g. after Retry clears a load error).
 */
export const useWebviewEvents = (windowId: string): UseWebviewEventsResult => {
  const [loadError, setLoadError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const webviewRef = useCallback(
    (element: Electron.WebviewTag | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (!element) {
        return;
      }

      const handleTitle = (e: Electron.PageTitleUpdatedEvent) => {
        // Only webview windows have page titles — never clobber a preview
        // window's real fileName or a terminal/generation window's label.
        const win = useWindowStore.getState().windows[windowId];
        if (win && win.kind !== undefined) {
          return;
        }
        useWindowStore.getState().updateWindow(windowId, { fileName: e.title });
      };

      const handleError = (e: Electron.DidFailLoadEvent) => {
        if (!e.isMainFrame) {
          return;
        }
        // -3 ERR_ABORTED: navigation stopped (user link click, redirect) —
        // not an error page.
        if (e.errorCode === -3) {
          return;
        }
        setLoadError(e.errorDescription || `Error ${e.errorCode}`);
      };

      const handleDidStartLoading = () => {
        setLoadError(null);
      };

      element.addEventListener("page-title-updated", handleTitle);
      element.addEventListener("did-fail-load", handleError);
      element.addEventListener("did-start-loading", handleDidStartLoading);

      cleanupRef.current = () => {
        element.removeEventListener("page-title-updated", handleTitle);
        element.removeEventListener("did-fail-load", handleError);
        element.removeEventListener("did-start-loading", handleDidStartLoading);
      };
    },
    [windowId]
  );

  useEffect(
    () => () => {
      cleanupRef.current?.();
    },
    []
  );

  const retry = useCallback(() => {
    // Clearing the error remounts the webview, which reloads `src` fresh.
    setLoadError(null);
  }, []);

  return { loadError, retry, webviewRef };
};

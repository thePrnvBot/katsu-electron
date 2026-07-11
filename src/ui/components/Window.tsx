import { Maximize, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";

import { useStore } from "../store/window-store";
import { ErrorOverlay } from "./error-overlay";

const TITLEBAR_H = 36;
const WINDOW_BORDER = 4;

const isWebUrl = (url: string) =>
  url.length > 0 && !url.startsWith("katsu://") && !url.startsWith("blob:");

const useWebviewEvents = (
  windowId: string,
  webviewRef: React.RefObject<Electron.WebviewTag | null>,
  updateWindow: (id: string, patch: Record<string, unknown>) => void
) => {
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }

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

      const state = useStore.getState();
      const current = state.windows.find((x) => x.id === windowId);
      if (!current || current.maximized) {
        return;
      }

      const maxW = state.grid.cellWidth * 0.9;
      const maxH = state.grid.cellHeight * 0.9;
      const contentMaxW = maxW - WINDOW_BORDER;
      const contentMaxH = maxH - WINDOW_BORDER - TITLEBAR_H;
      const scale = Math.min(contentMaxW / msg.w, contentMaxH / msg.h, 1);
      const w = Math.round(msg.w * scale) + WINDOW_BORDER;
      const h = Math.round(msg.h * scale) + WINDOW_BORDER + TITLEBAR_H;

      if (Math.abs(current.w - w) > 2 || Math.abs(current.h - h) > 2) {
        const cx = state.currentCell.x * state.grid.cellWidth;
        const cy = state.currentCell.y * state.grid.cellHeight;
        updateWindow(windowId, {
          h,
          w,
          x: cx + (state.grid.cellWidth - w) / 2,
          y: cy + (state.grid.cellHeight - h) / 2,
        });
      }
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
  }, [windowId, updateWindow, webviewRef]);

  return loadError;
};

export const Window = ({ windowId }: { windowId: string }) => {
  const win = useStore((s) => s.windows.find((w) => w.id === windowId));
  const updateWindow = useStore((s) => s.updateWindow);
  const activeWindowId = useStore((s) => s.activeWindowId);
  const setActiveWindow = useStore((s) => s.setActiveWindow);
  const maximizeWindow = useStore((s) => s.maximizeWindow);
  const centerOnWindow = useStore((s) => s.centerOnWindow);
  const bringToFront = useStore((s) => s.bringToFront);
  const removeWindow = useStore((s) => s.removeWindow);
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const [blockedCount, setBlockedCount] = useState(0);

  const showAdPill = isWebUrl(win?.url ?? "");
  const loadError = useWebviewEvents(windowId, webviewRef, updateWindow);

  useEffect(() => {
    if (!showAdPill) {
      return;
    }
    const unsub = window.electronAPI.setBlockedCountHandler(
      windowId,
      (data) => {
        try {
          const winOrigin = new URL(win?.url ?? "").origin;
          if (data.origin === winOrigin) {
            setBlockedCount(data.count);
          }
        } catch {
          // invalid URL
        }
      }
    );
    return unsub;
  }, [showAdPill, win?.url, windowId]);

  useEffect(
    () => () => {
      const w = useStore.getState().windows.find((x) => x.id === windowId);
      if (w && w.url.startsWith("blob:")) {
        URL.revokeObjectURL(w.url);
      }
    },
    [windowId]
  );

  if (!win) {
    return null;
  }

  const isActive = activeWindowId === win.id;
  const displayName = win.fileName || win.url;

  return (
    <Rnd
      size={{ height: win.h, width: win.w }}
      position={{ x: win.x, y: win.y }}
      minWidth={200}
      minHeight={120}
      enableResizing
      dragHandleClassName="titlebar"
      bounds={undefined}
      onDragStart={() => {
        setActiveWindow(win.id);
        bringToFront(win.id);
      }}
      onDragStop={(_, d) => {
        updateWindow(win.id, { x: d.x, y: d.y });
      }}
      onResizeStart={() => {
        setActiveWindow(win.id);
        bringToFront(win.id);
      }}
      onResizeStop={(_, __, ref, ___, pos) => {
        updateWindow(win.id, {
          h: Math.trunc(Number(ref.style.height)),
          w: Math.trunc(Number(ref.style.width)),
          x: pos.x,
          y: pos.y,
        });
      }}
      style={{
        background: isActive ? "#1a1a1a" : "#111",
        border: isActive ? "2px solid rgba(255,255,255,0.4)" : "1px solid #444",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: win.z ?? 1,
      }}
    >
      <div
        className={`titlebar flex h-9 items-center justify-between px-2.5 select-none ${
          isActive ? "bg-[#333]" : "bg-[#2a2a2a]"
        } text-[#ddd] cursor-grab`}
        onDoubleClick={() => centerOnWindow(win.id)}
      >
        <span className="w-10 shrink-0 opacity-50">{win.id.slice(0, 4)}</span>
        <span className="truncate text-center text-sm">{displayName}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          {showAdPill && blockedCount > 0 && (
            <div
              className="mr-1 flex items-center gap-1 rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-white/60"
              title={`${blockedCount} Ads Blocked`}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
              <span>{blockedCount}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => maximizeWindow(win.id)}
            className="flex h-5.5 w-5.5 items-center justify-center text-[#aaa]"
          >
            <Maximize size={14} />
          </button>
          <button
            type="button"
            onClick={() => removeWindow(win.id)}
            className="flex h-5.5 w-5.5 items-center justify-center text-[#aaa]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div
        style={{
          background: "#0f0f0f",
          flex: 1,
          minHeight: 0,
          position: "relative",
        }}
      >
        {win.url && !loadError && (
          <webview
            ref={webviewRef as React.RefObject<Electron.WebviewTag>}
            src={win.url}
            style={{
              border: "none",
              height: "100%",
              left: 0,
              position: "absolute",
              top: 0,
              width: "100%",
            }}
            preload={window.electronAPI.getWebviewPreloadPath()}
            partition="persist:katsu"
          />
        )}
        {loadError && (
          <ErrorOverlay
            url={win.url}
            error={loadError}
            onRetry={() => {
              const webview = webviewRef.current;
              if (webview) {
                webview.reload();
              }
            }}
          />
        )}
        {!win.url && !loadError && (
          <div
            style={{
              alignItems: "center",
              color: "#777",
              display: "flex",
              inset: 0,
              justifyContent: "center",
              padding: 12,
              position: "absolute",
            }}
          >
            Empty window
          </div>
        )}
      </div>
    </Rnd>
  );
};

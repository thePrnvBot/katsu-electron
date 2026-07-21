import { Maximize, ShieldBan, X } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";

import { useWebviewEvents } from "../hooks/use-webview-events";
import {
  ARROW_DELTAS,
  PEEK_SCALE,
  WEBVIEW_LIVE_CELL_RADIUS,
  WINDOW_KEYBOARD_NUDGE_PX,
} from "../lib/constants";
import { useCameraStore } from "../store/camera-store";
import { useSettingsStore } from "../store/settings-store";
import { useWindowStore } from "../store/window-store";
import type { Window as WindowData } from "../store/window-store";
import { ErrorOverlay } from "./error-overlay";
import { FilePreview } from "./file-preview";

const isWebUrl = (url: string) =>
  url.length > 0 && !url.startsWith("katsu://") && !url.startsWith("blob:");

const absoluteFill: React.CSSProperties = {
  border: "none",
  height: "100%",
  left: 0,
  position: "absolute",
  top: 0,
  width: "100%",
};

interface WindowBodyProps {
  isNearCamera: boolean;
  loadError: string | null;
  retry: () => void;
  webviewRef: (element: Electron.WebviewTag | null) => void;
  win: WindowData;
  windowId: string;
}

const WindowBody = ({
  isNearCamera,
  loadError,
  retry,
  webviewRef,
  win,
  windowId,
}: WindowBodyProps) => {
  const keepWindowsAlive = useSettingsStore((s) => s.settings.keepWindowsAlive);
  const isComponentPreview = win.previewType && win.previewType !== "pdf";

  return (
    <div
      style={{
        background: "#0f0f0f",
        flex: 1,
        minHeight: 0,
        position: "relative",
      }}
    >
      {isComponentPreview && !loadError && (
        <FilePreview
          fileName={win.fileName ?? ""}
          previewType={win.previewType}
          url={win.url}
          windowId={windowId}
        />
      )}
      {!isComponentPreview &&
        win.url &&
        !loadError &&
        (() => {
          if (win.previewType === "pdf") {
            // katsu:// PDFs are local staged files — the protocol handler only
            // serves the drops dir. The viewer still runs sandboxed.
            return (
              <iframe
                src={win.url}
                sandbox="allow-scripts"
                style={absoluteFill}
                title={win.fileName || "PDF Preview"}
              />
            );
          }
          if (!isNearCamera && !keepWindowsAlive) {
            return (
              <div
                style={{
                  alignItems: "center",
                  color: "#777",
                  display: "flex",
                  inset: 0,
                  justifyContent: "center",
                  padding: 12,
                  position: "absolute",
                  textAlign: "center",
                }}
              >
                Suspended — return to this cell to reload
              </div>
            );
          }
          return (
            <webview
              ref={webviewRef}
              src={win.url}
              style={{
                ...absoluteFill,
                visibility: isNearCamera ? "visible" : "hidden",
              }}
              partition="persist:katsu"
              webpreferences="contextIsolation=yes, sandbox=yes, nodeIntegration=no"
            />
          );
        })()}
      {loadError && (
        <ErrorOverlay error={loadError} url={win.url} onRetry={retry} />
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
  );
};

// eslint-disable-next-line prefer-arrow-callback -- named function for React devtools
export const Window = memo(function Window({ windowId }: { windowId: string }) {
  const win = useWindowStore((s) => s.windows.find((w) => w.id === windowId));
  const updateWindow = useWindowStore((s) => s.updateWindow);
  const windowPeeking = useSettingsStore((s) => s.settings.windowPeeking);
  // Boolean selector: focus changes re-render only the two affected windows.
  const isActive = useWindowStore((s) => s.activeWindowId === windowId);
  const setActiveWindow = useWindowStore((s) => s.setActiveWindow);
  const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
  const bringToFront = useWindowStore((s) => s.bringToFront);
  const removeWindow = useWindowStore((s) => s.removeWindow);
  const [blockedCount, setBlockedCount] = useState(0);

  const { loadError, retry, webviewRef } = useWebviewEvents(windowId);

  const winUrl = win?.url ?? "";
  const showAdPill = isWebUrl(winUrl);

  const winOrigin = useMemo(() => {
    try {
      return new URL(winUrl).origin;
    } catch {
      return null;
    }
  }, [winUrl]);

  const isNearCamera = useCameraStore((s) => {
    const w = useWindowStore.getState().windows.find((x) => x.id === windowId);
    if (!w || !isWebUrl(w.url)) {
      return true;
    }
    const cellX = Math.floor((w.x + w.w / 2) / s.grid.cellWidth);
    const cellY = Math.floor((w.y + w.h / 2) / s.grid.cellHeight);
    return (
      Math.max(
        Math.abs(cellX - s.currentCell.x),
        Math.abs(cellY - s.currentCell.y)
      ) <= WEBVIEW_LIVE_CELL_RADIUS
    );
  });

  useEffect(() => {
    if (!(showAdPill && winOrigin)) {
      return;
    }
    return window.electronAPI.setBlockedCountHandler(windowId, (data) => {
      if (data.origin === winOrigin) {
        setBlockedCount(data.count);
      }
    });
  }, [showAdPill, winOrigin, windowId]);

  if (!win) {
    return null;
  }

  const displayName = win.fileName || win.url;

  const handleTitlebarKeyDown = (e: React.KeyboardEvent) => {
    const delta = ARROW_DELTAS[e.key];
    if (!delta) {
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      updateWindow(win.id, {
        x: win.x + delta[0] * WINDOW_KEYBOARD_NUDGE_PX,
        y: win.y + delta[1] * WINDOW_KEYBOARD_NUDGE_PX,
      });
      return;
    }
    if (e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      updateWindow(win.id, {
        h: Math.max(120, win.h + delta[1] * WINDOW_KEYBOARD_NUDGE_PX),
        w: Math.max(200, win.w + delta[0] * WINDOW_KEYBOARD_NUDGE_PX),
      });
    }
  };

  return (
    <Rnd
      size={{ height: win.h, width: win.w }}
      position={{ x: win.x, y: win.y }}
      minWidth={200}
      minHeight={120}
      enableResizing
      dragHandleClassName="titlebar"
      bounds={undefined}
      scale={windowPeeking ? PEEK_SCALE : 1}
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
      {/* Keyboard: Shift+Arrow moves, Alt+Arrow resizes. */}
      <div
        className={`titlebar flex h-9 items-center justify-between px-2.5 select-none ${
          isActive ? "bg-[#333]" : "bg-[#2a2a2a]"
        } text-[#ddd] cursor-grab`}
        role="toolbar"
        aria-label="Window controls"
        tabIndex={0}
        onKeyDown={handleTitlebarKeyDown}
      >
        <span className="w-10 shrink-0 opacity-50">{win.id.slice(0, 4)}</span>
        <span className="truncate text-center text-sm">{displayName}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          {showAdPill && blockedCount > 0 && (
            <div
              className="mr-1 flex items-center gap-1 rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-white/60"
              title={`${blockedCount} Ads Blocked`}
            >
              <ShieldBan size={10} />
              <span>{blockedCount}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => maximizeWindow(win.id)}
            aria-label="Maximize window"
            className="flex h-5.5 w-5.5 items-center justify-center rounded-md text-[#aaa] transition hover:scale-105 hover:bg-white/10 hover:text-white"
          >
            <Maximize size={14} />
          </button>
          <button
            type="button"
            onClick={() => removeWindow(win.id)}
            aria-label="Close window"
            className="flex h-5.5 w-5.5 items-center justify-center rounded-md text-[#aaa] transition hover:scale-105 hover:bg-red-500/20 hover:text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <WindowBody
        isNearCamera={isNearCamera}
        loadError={loadError}
        retry={retry}
        webviewRef={webviewRef}
        win={win}
        windowId={windowId}
      />
    </Rnd>
  );
});

/** Window chrome, drag and resize handling, and mounted content tiers. */

import {
  FileText,
  Globe,
  Maximize,
  ShieldBan,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";

import type { PreviewType } from "../../shared/contract";
import { useWebviewEvents } from "../hooks/use-webview-events";
import {
  getArrowDelta,
  PEEK_SCALE,
  WEBVIEW_LIVE_CELL_RADIUS,
  WINDOW_KEYBOARD_NUDGE_PX,
} from "../lib/constants";
import { useCameraStore } from "../store/camera-store";
import { useSettingsStore } from "../store/settings-store";
import { useWarmWebviewsStore } from "../store/warm-webviews-store";
import { useWindowStore } from "../store/window-store";
import type { Window as WindowData } from "../store/window-store";
import { windowCenterCell } from "../utils/layout";
import { ErrorOverlay } from "./error-overlay";
import { FilePreview } from "./file-preview";
import { GenerationView } from "./generation-view";
import { TerminalView } from "./terminal-view";

const isWebUrl = (url: string) =>
  url.length > 0 && !url.startsWith("katsu://") && !url.startsWith("blob:");

/** Leading icon in the window title bar, keyed to the content type. */
const WindowKindIcon = ({ win }: { win: WindowData }) => {
  if (win.kind === "terminal") {
    return <Terminal size={13} />;
  }
  if (win.kind === "generation") {
    return <Sparkles size={13} />;
  }
  if (win.previewType !== undefined) {
    return <FileText size={13} />;
  }
  return <Globe size={13} />;
};

const absoluteFill: React.CSSProperties = {
  border: "none",
  height: "100%",
  left: 0,
  position: "absolute",
  top: 0,
  width: "100%",
};

const suspensionStyle: React.CSSProperties = {
  alignItems: "center",
  color: "#777",
  display: "flex",
  inset: 0,
  justifyContent: "center",
  padding: 12,
  position: "absolute",
  textAlign: "center",
};

const windowChromeStyle = (
  isActive: boolean,
  z: number
): React.CSSProperties => ({
  background: isActive ? "#181818" : "#121212",
  border: isActive
    ? "1px solid rgba(255,255,255,0.28)"
    : "1px solid rgba(255,255,255,0.09)",
  borderRadius: 12,
  boxShadow: isActive
    ? "0 14px 44px rgba(0,0,0,0.6)"
    : "0 6px 22px rgba(0,0,0,0.4)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  zIndex: z,
});

interface WindowBodyProps {
  isNearCamera: boolean;
  isWarm: boolean;
  loadError: string | null;
  retry: () => void;
  webviewRef: (element: Electron.WebviewTag | null) => void;
  win: WindowData;
  windowId: string;
}

/** Chebyshev distance in grid cells between a window's center and the
 * camera's settled cell. */
const cellDistanceFromCamera = (
  window: WindowData,
  camera: {
    readonly settledCell: { readonly x: number; readonly y: number };
    readonly grid: { readonly cellHeight: number; readonly cellWidth: number };
  }
): number => {
  const cell = windowCenterCell(window, camera.grid);
  return Math.max(
    Math.abs(cell.x - camera.settledCell.x),
    Math.abs(cell.y - camera.settledCell.y)
  );
};

/** The webview / PDF iframe for a hydrated, URL-bearing window. */
const WebviewContent = ({
  isNearCamera,
  isWarm,
  keepWindowsAlive,
  webviewRef,
  win,
}: {
  isNearCamera: boolean;
  isWarm: boolean;
  keepWindowsAlive: boolean;
  webviewRef: (element: Electron.WebviewTag | null) => void;
  win: WindowData;
}) => {
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
  const shouldMount = isNearCamera || isWarm || keepWindowsAlive;
  if (!shouldMount) {
    return (
      <div style={suspensionStyle}>
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
        // Warm-but-far webviews keep their renderer (and page state) alive
        // while staying hidden; near windows paint normally.
        visibility: isNearCamera || keepWindowsAlive ? "visible" : "hidden",
      }}
      partition="persist:katsu"
      webpreferences="contextIsolation=yes, sandbox=yes, nodeIntegration=no"
    />
  );
};

type WindowContentState =
  | { readonly kind: "empty" }
  | { readonly kind: "error"; readonly error: string }
  | { readonly kind: "generation" }
  | { readonly kind: "preview"; readonly previewType: PreviewType }
  | { readonly kind: "suspended" }
  | { readonly kind: "terminal" }
  | { readonly kind: "webview" };

/**
 * What the window body should render this pass: restored windows start as
 * "suspended" chrome-only shells and hydrate later; load errors win over
 * everything else.
 */
const windowContentState = (
  win: WindowData,
  loadError: string | null
): WindowContentState => {
  if (!(win.live ?? true)) {
    return { kind: "suspended" };
  }
  if (win.kind === "terminal") {
    return { kind: "terminal" };
  }
  if (win.kind === "generation") {
    return { kind: "generation" };
  }
  if (loadError !== null) {
    return { error: loadError, kind: "error" };
  }
  if (win.previewType !== undefined && win.previewType !== "pdf") {
    return { kind: "preview", previewType: win.previewType };
  }
  if (win.url) {
    return { kind: "webview" };
  }
  return { kind: "empty" };
};

const WindowBody = ({
  isNearCamera,
  isWarm,
  loadError,
  retry,
  webviewRef,
  win,
  windowId,
}: WindowBodyProps) => {
  const keepWindowsAlive = useSettingsStore((s) => s.settings.keepWindowsAlive);
  const contentState = windowContentState(win, loadError);

  return (
    <div
      data-window-content=""
      style={{
        background: "#0f0f0f",
        flex: 1,
        minHeight: 0,
        position: "relative",
      }}
    >
      {contentState.kind === "suspended" && (
        <div style={suspensionStyle}>Suspended</div>
      )}
      {contentState.kind === "terminal" && <TerminalView windowId={windowId} />}
      {contentState.kind === "generation" && (
        <GenerationView windowId={windowId} />
      )}
      {contentState.kind === "preview" && (
        <FilePreview
          fileName={win.fileName ?? ""}
          previewType={contentState.previewType}
          url={win.url}
          windowId={windowId}
        />
      )}
      {contentState.kind === "webview" && (
        <WebviewContent
          isNearCamera={isNearCamera}
          isWarm={isWarm}
          keepWindowsAlive={keepWindowsAlive}
          webviewRef={webviewRef}
          win={win}
        />
      )}
      {contentState.kind === "error" && (
        <ErrorOverlay
          error={contentState.error}
          url={win.url}
          onRetry={retry}
        />
      )}
      {contentState.kind === "empty" && (
        <div style={suspensionStyle}>Empty window</div>
      )}
    </div>
  );
};

// eslint-disable-next-line prefer-arrow-callback -- named function for React devtools
export const Window = memo(function Window({ windowId }: { windowId: string }) {
  const win = useWindowStore((s) => s.windows[windowId]);
  const updateWindow = useWindowStore((s) => s.updateWindow);
  const windowPeeking = useSettingsStore((s) => s.settings.windowPeeking);
  // Boolean selector: focus changes re-render only the two affected windows.
  const isActive = useWindowStore((s) => s.activeWindowId === windowId);
  const setActiveWindow = useWindowStore((s) => s.setActiveWindow);
  const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
  const bringToFront = useWindowStore((s) => s.bringToFront);
  const removeWindow = useWindowStore((s) => s.removeWindow);
  const warmWebview = useWarmWebviewsStore((s) => s.warm);
  const forgetWebview = useWarmWebviewsStore((s) => s.forget);
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

  // Distance decisions use the camera's settled cell, so tiers flip once per
  // cell step — never mid-pan. Flipping mount state while moving destroys
  // and respawns guest renderers, the main traversal stutter with heavy
  // pages.
  const isNearCamera = useCameraStore((s) => {
    const w = useWindowStore.getState().windows[windowId];
    if (!w || !isWebUrl(w.url)) {
      return true;
    }
    return cellDistanceFromCamera(w, s) <= WEBVIEW_LIVE_CELL_RADIUS;
  });

  const isWarm = useWarmWebviewsStore((s) => s.warmIds.includes(windowId));

  // Recently visible webviews stay mounted (hidden) so returning reuses the
  // renderer; removed windows leave the pool.
  useEffect(() => {
    if (isNearCamera && isWebUrl(winUrl)) {
      warmWebview(windowId);
    }
  }, [isNearCamera, warmWebview, winUrl, windowId]);

  useEffect(() => {
    if (win === undefined) {
      forgetWebview(windowId);
    }
  }, [forgetWebview, win, windowId]);

  useEffect(() => {
    if (!(showAdPill && winOrigin)) {
      return;
    }
    return window.electronAPI.setBlockedCountHandler(winOrigin, (data) => {
      setBlockedCount(data.count);
    });
  }, [showAdPill, winOrigin]);

  if (!win) {
    return null;
  }

  const displayName = win.fileName || win.url;

  const handleTitlebarKeyDown = (e: React.KeyboardEvent) => {
    const delta = getArrowDelta(e.key);
    if (!delta) {
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      updateWindow(win.id, {
        maximized: false,
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
        maximized: false,
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
        // DraggableCore fires a stop on every mouseup, including plain
        // clicks on the titlebar buttons (zero movement). Resetting
        // `maximized` there would clear the flag while the window keeps its
        // full-cell size, so the next Maximize click saves the maximized
        // bounds as prevBounds and the toggle never returns to windowed.
        // Only a drag that actually moved un-maximizes.
        if (d.deltaX === 0 && d.deltaY === 0) {
          return;
        }
        updateWindow(win.id, { maximized: false, x: d.x, y: d.y });
      }}
      onResizeStart={() => {
        setActiveWindow(win.id);
        bringToFront(win.id);
      }}
      onResizeStop={(_, __, ref, ___, pos) => {
        updateWindow(win.id, {
          h: Math.trunc(Number(ref.style.height)),
          maximized: false,
          w: Math.trunc(Number(ref.style.width)),
          x: pos.x,
          y: pos.y,
        });
      }}
      style={windowChromeStyle(isActive, win.z ?? 1)}
    >
      {/* Keyboard: Shift+Arrow moves, Alt+Arrow resizes. */}
      <div
        className={`titlebar flex h-9 shrink-0 cursor-grab items-center gap-2 border-b px-2.5 select-none transition-colors ${
          isActive
            ? "border-white/10 bg-gradient-to-b from-[#383838] to-[#2c2c2c] text-white/90"
            : "border-white/5 bg-gradient-to-b from-[#242424] to-[#1d1d1d] text-white/55"
        }`}
        role="toolbar"
        aria-label="Window controls"
        tabIndex={0}
        onKeyDown={handleTitlebarKeyDown}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
            isActive ? "bg-white/10 text-white/80" : "bg-white/5 text-white/40"
          }`}
        >
          <WindowKindIcon win={win} />
        </span>
        <span className="min-w-0 flex-1 truncate text-center text-[13px] font-medium">
          {displayName}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {showAdPill && blockedCount > 0 && (
            <div
              className="mr-1 flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/55"
              title={`${blockedCount} ads blocked`}
            >
              <ShieldBan size={10} />
              <span>{blockedCount}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => maximizeWindow(win.id)}
            aria-label="Maximize window"
            className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <Maximize size={14} />
          </button>
          <button
            type="button"
            onClick={() => removeWindow(win.id)}
            aria-label="Close window"
            className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 transition hover:bg-red-500/20 hover:text-red-300"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <WindowBody
        isNearCamera={isNearCamera}
        isWarm={isWarm}
        loadError={loadError}
        retry={retry}
        webviewRef={webviewRef}
        win={win}
        windowId={windowId}
      />
    </Rnd>
  );
});

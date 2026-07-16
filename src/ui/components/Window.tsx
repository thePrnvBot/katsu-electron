import { Maximize, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";

import { useWebviewEvents } from "../hooks/use-webview-events";
import { useWindowStore } from "../store/window-store";
import type { Window as WindowData } from "../store/window-store";
import { ErrorOverlay } from "./error-overlay";
import { FilePreview } from "./file-preview";

const isWebUrl = (url: string) =>
  url.length > 0 && !url.startsWith("katsu://") && !url.startsWith("blob:");

const WindowBody = ({
  loadError,
  webviewRef,
  win,
  windowId,
}: {
  loadError: string | null;
  webviewRef: React.RefObject<Electron.WebviewTag | null>;
  win: WindowData;
  windowId: string;
}) => {
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
        (win.previewType === "pdf" ? (
          <iframe
            src={win.url}
            style={{
              border: "none",
              height: "100%",
              left: 0,
              position: "absolute",
              top: 0,
              width: "100%",
            }}
            title={win.fileName || "PDF Preview"}
          />
        ) : (
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
        ))}
      {loadError && (
        <ErrorOverlay
          error={loadError}
          url={win.url}
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
  );
};

export const Window = ({ windowId }: { windowId: string }) => {
  const win = useWindowStore((s) => s.windows.find((w) => w.id === windowId));
  const updateWindow = useWindowStore((s) => s.updateWindow);
  const activeWindowId = useWindowStore((s) => s.activeWindowId);
  const setActiveWindow = useWindowStore((s) => s.setActiveWindow);
  const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
  const bringToFront = useWindowStore((s) => s.bringToFront);
  const removeWindow = useWindowStore((s) => s.removeWindow);
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const [blockedCount, setBlockedCount] = useState(0);

  const showAdPill = isWebUrl(win?.url ?? "");
  const loadError = useWebviewEvents(windowId, webviewRef);

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
            className="flex h-5.5 w-5.5 items-center justify-center rounded-md text-[#aaa] transition hover:scale-105 hover:bg-white/10 hover:text-white"
          >
            <Maximize size={14} />
          </button>
          <button
            type="button"
            onClick={() => removeWindow(win.id)}
            className="flex h-5.5 w-5.5 items-center justify-center rounded-md text-[#aaa] transition hover:scale-105 hover:bg-red-500/20 hover:text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <WindowBody
        loadError={loadError}
        webviewRef={webviewRef}
        win={win}
        windowId={windowId}
      />
    </Rnd>
  );
};

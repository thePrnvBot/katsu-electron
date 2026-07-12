import * as Effect from "effect/Effect";
import { useEffect, useRef, useState } from "react";

import { CameraAnimator } from "./components/camera-animator";
import { CommandMenu } from "./components/command-menu";
import { Minimap } from "./components/minimap";
import { PermissionDialog } from "./components/permission-dialog";
import { SearchBar } from "./components/search-bar";
import { TitleBar } from "./components/title-bar";
import { Window } from "./components/window";
import { World } from "./components/World";
import { useStore } from "./store/window-store";
import { createFilePreview } from "./utils/file-preview";

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "ico",
]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov", "mkv", "avi"]);
const TITLEBAR_H = 36;
const WINDOW_BORDER = 4;

const normalizeUrl = (value: string) => {
  if (!value) {
    return null;
  }
  if (value.startsWith("file://")) {
    return value;
  }
  if (value.startsWith("katsu://")) {
    return value;
  }
  if (value.startsWith("http://")) {
    return `https://${value.slice("http://".length)}`;
  }
  if (value.startsWith("https://")) {
    return value;
  }
  return `https://${value}`;
};

const getMediaDimensions = (
  url: string,
  ext: string
): Promise<{ w: number; h: number }> =>
  Effect.runPromise(
    Effect.async<{ w: number; h: number }, never>((resolve) => {
      let resolved = false;
      const safeResolve = (value: { w: number; h: number }) => {
        if (!resolved) {
          resolved = true;
          resolve(Effect.succeed(value));
        }
      };

      const timeout = setTimeout(() => safeResolve({ h: 0, w: 0 }), 3000);

      if (IMAGE_EXTENSIONS.has(ext)) {
        const img = new Image();
        img.addEventListener(
          "load",
          () => {
            clearTimeout(timeout);
            safeResolve({ h: img.naturalHeight, w: img.naturalWidth });
          },
          { once: true }
        );
        img.addEventListener(
          "error",
          () => {
            clearTimeout(timeout);
            safeResolve({ h: 0, w: 0 });
          },
          { once: true }
        );
        img.src = url;
      } else if (VIDEO_EXTENSIONS.has(ext)) {
        const video = document.createElement("video");
        video.addEventListener(
          "loadedmetadata",
          () => {
            clearTimeout(timeout);
            safeResolve({ h: video.videoHeight, w: video.videoWidth });
          },
          { once: true }
        );
        video.addEventListener(
          "error",
          () => {
            clearTimeout(timeout);
            safeResolve({ h: 0, w: 0 });
          },
          { once: true }
        );
        video.src = url;
      } else {
        clearTimeout(timeout);
        safeResolve({ h: 0, w: 0 });
      }
    })
  );

export default function App() {
  const moveCell = useStore((s) => s.moveCell);
  const currentCell = useStore((s) => s.currentCell);
  const grid = useStore((s) => s.grid);
  const windows = useStore((s) => s.windows);
  const addWindow = useStore((s) => s.addWindow);
  const bringToFront = useStore((s) => s.bringToFront);
  const setActiveWindow = useStore((s) => s.setActiveWindow);
  const [urlField, setUrlField] = useState("");
  const wheelAccum = useRef({ x: 0, y: 0 });

  // Load persisted state on mount
  useEffect(() => {
    window.electronAPI.setStateLoadedHandler((savedWindows: unknown[]) => {
      if (Array.isArray(savedWindows)) {
        for (const w of savedWindows) {
          const win = w as Record<string, unknown>;
          const bounds = win.bounds as Record<string, number> | undefined;
          addWindow({
            fileName: win.title as string | undefined,
            h: bounds?.height ?? 400,
            id: win.id as string,
            url: win.url as string,
            w: bounds?.width ?? 600,
            x: bounds?.x ?? 100,
            y: bounds?.y ?? 100,
            z: win.zIndex as number | undefined,
          });
        }
      }
    });

    window.electronAPI.setSettingsLoadedHandler((savedSettings: unknown) => {
      if (
        savedSettings &&
        typeof savedSettings === "object" &&
        "windowPeeking" in savedSettings
      ) {
        useStore.getState().loadSettings({
          windowPeeking: (savedSettings as { windowPeeking: boolean })
            .windowPeeking,
        });
      }
    });
  }, [addWindow]);

  // Save state when main process requests it (before quit)
  useEffect(() => {
    window.electronAPI.setRequestSaveHandler(() => {
      const currentWindows = useStore.getState().windows;
      const metadata = currentWindows.map((w) => ({
        bounds: { height: w.h, width: w.w, x: w.x, y: w.y },
        id: w.id,
        title: w.fileName,
        url: w.url,
        zIndex: w.z ?? 1,
      }));
      window.electronAPI.saveStateResponse(metadata);
    });
  }, []);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "IFRAME" || target?.tagName === "WEBVIEW") {
        return;
      }

      const threshold = 80;
      wheelAccum.current.x += e.deltaX;
      wheelAccum.current.y += e.deltaY;

      if (Math.abs(wheelAccum.current.x) > threshold) {
        moveCell(wheelAccum.current.x > 0 ? 1 : -1, 0);
        wheelAccum.current.x = 0;
      }
      if (Math.abs(wheelAccum.current.y) > threshold) {
        moveCell(0, wheelAccum.current.y > 0 ? 1 : -1);
        wheelAccum.current.y = 0;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [moveCell]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) {
        return;
      }
      if ((e.target as HTMLElement).closest("[cmdk-root]")) {
        return;
      }
      if (e.key === "ArrowRight") {
        moveCell(1, 0);
      }
      if (e.key === "ArrowLeft") {
        moveCell(-1, 0);
      }
      if (e.key === "ArrowDown") {
        moveCell(0, 1);
      }
      if (e.key === "ArrowUp") {
        moveCell(0, -1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveCell]);

  const openWindow = (cleanUrl: string) => {
    const newWindowId = crypto.randomUUID();
    addWindow({
      h: 400,
      id: newWindowId,
      url: cleanUrl,
      w: 600,
      x: currentCell.x * grid.cellWidth + 100 + Math.random() * 50,
      y: currentCell.y * grid.cellHeight + 100 + Math.random() * 50,
    });
    setActiveWindow(newWindowId);
    bringToFront(newWindowId);
  };

  const openSite = () => {
    const cleanUrl = normalizeUrl(urlField);
    if (!cleanUrl) {
      return;
    }
    openWindow(cleanUrl);
    setUrlField("");
  };

  const handleFileOpen = async (files: File[]) => {
    const previews = await Promise.all(files.map(createFilePreview));

    for (const preview of previews) {
      const { url, fileName, nativeWidth, nativeHeight } = preview;
      const newWindowId = crypto.randomUUID();

      const contentMaxW = grid.cellWidth * 0.9 - WINDOW_BORDER;
      const contentMaxH = grid.cellHeight * 0.9 - WINDOW_BORDER - TITLEBAR_H;
      let w = nativeWidth ?? 700;
      let h = nativeHeight ?? 500;

      if (nativeWidth && nativeHeight) {
        const scale = Math.min(
          contentMaxW / nativeWidth,
          contentMaxH / nativeHeight,
          1
        );
        w = Math.round(nativeWidth * scale) + WINDOW_BORDER;
        h = Math.round(nativeHeight * scale) + WINDOW_BORDER + TITLEBAR_H;
      } else {
        w = Math.min(w, contentMaxW) + WINDOW_BORDER;
        h = Math.min(h, contentMaxH) + WINDOW_BORDER + TITLEBAR_H;
      }

      addWindow({
        fileName,
        h,
        id: newWindowId,
        url,
        w,
        x: currentCell.x * grid.cellWidth + (grid.cellWidth - w) / 2,
        y: currentCell.y * grid.cellHeight + (grid.cellHeight - h) / 2,
      });
      setActiveWindow(newWindowId);
      bringToFront(newWindowId);
    }
  };

  const handleOpenFileDialog = async () => {
    const result = await window.electronAPI.openFile();
    if (!result.canceled && result.filePaths.length > 0) {
      const fileData = await Promise.all(
        result.filePaths.map(async (filePath) => {
          const fileName = filePath.split(/[/\\]/u).pop() ?? filePath;
          const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
          const rawUrl = `katsu://preview/${encodeURIComponent(filePath)}?raw`;
          const { w: nativeW, h: nativeH } = await getMediaDimensions(
            rawUrl,
            ext
          );
          return { ext, fileName, filePath, nativeH, nativeW };
        })
      );

      for (const { filePath, fileName, nativeH, nativeW } of fileData) {
        const contentMaxW = grid.cellWidth * 0.9 - WINDOW_BORDER;
        const contentMaxH = grid.cellHeight * 0.9 - WINDOW_BORDER - TITLEBAR_H;
        let w = 700;
        let h = 500;

        if (nativeW && nativeH) {
          const scale = Math.min(
            contentMaxW / nativeW,
            contentMaxH / nativeH,
            1
          );
          w = Math.round(nativeW * scale) + WINDOW_BORDER;
          h = Math.round(nativeH * scale) + WINDOW_BORDER + TITLEBAR_H;
        } else {
          w = Math.min(w, contentMaxW) + WINDOW_BORDER;
          h = Math.min(h, contentMaxH) + WINDOW_BORDER + TITLEBAR_H;
        }

        const newWindowId = crypto.randomUUID();
        addWindow({
          fileName,
          h,
          id: newWindowId,
          url: `katsu://preview/${encodeURIComponent(filePath)}`,
          w,
          x: currentCell.x * grid.cellWidth + (grid.cellWidth - w) / 2,
          y: currentCell.y * grid.cellHeight + (grid.cellHeight - h) / 2,
        });
        setActiveWindow(newWindowId);
        bringToFront(newWindowId);
      }
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden">
      <CameraAnimator />
      <TitleBar />
      <CommandMenu />
      <SearchBar
        url={urlField}
        openSite={openSite}
        handleChange={setUrlField}
        onOpenFileDialog={handleOpenFileDialog}
      />
      <World onFileDrop={handleFileOpen}>
        {windows.map((w) => (
          <Window key={w.id} windowId={w.id} />
        ))}
      </World>
      <Minimap />
      <PermissionDialog />
    </div>
  );
}

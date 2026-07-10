import { useEffect, useRef, useState } from "react";
import { useStore } from "./store/windowStore";
import { World } from "./components/World";
import { Window } from "./components/Window";
import { Minimap } from "./components/Minimap";
import { SearchBar } from "./components/SearchBar";
import { TitleBar } from "./components/TitleBar";
import { CommandMenu } from "./components/CommandMenu";
import { CameraAnimator } from "./components/CameraAnimator";
import { createFilePreview } from "./utils/filePreview";
import { usePermissions } from "./hooks/usePermissions";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov", "mkv", "avi"]);
const TITLEBAR_H = 36;
const WINDOW_BORDER = 4;

function getMediaDimensions(url: string, ext: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ w: 0, h: 0 }), 3000);

    if (IMAGE_EXTENSIONS.has(ext)) {
      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        resolve({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve({ w: 0, h: 0 });
      };
      img.src = url;
    } else if (VIDEO_EXTENSIONS.has(ext)) {
      const video = document.createElement("video");
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve({ w: video.videoWidth, h: video.videoHeight });
      };
      video.onerror = () => {
        clearTimeout(timeout);
        resolve({ w: 0, h: 0 });
      };
      video.src = url;
    } else {
      clearTimeout(timeout);
      resolve({ w: 0, h: 0 });
    }
  });
}

export default function App() {
  usePermissions();
  const moveCell = useStore((s) => s.moveCell);
  const currentCell = useStore((s) => s.currentCell);
  const grid = useStore((s) => s.grid);
  const windows = useStore((s) => s.windows);
  const addWindow = useStore((s) => s.addWindow);
  const setActiveWindow = useStore((s) => s.setActiveWindow);
  const [urlField, setUrlField] = useState("");
  const wheelAccum = useRef({ x: 0, y: 0 });

  // Load persisted state on mount
  useEffect(() => {
    const cleanup = window.electronAPI.onStateLoaded((savedWindows: unknown[]) => {
      if (Array.isArray(savedWindows)) {
        for (const w of savedWindows) {
          const win = w as Record<string, unknown>;
          const bounds = win.bounds as Record<string, number> | undefined;
          addWindow({
            id: win.id as string,
            x: bounds?.x ?? 100,
            y: bounds?.y ?? 100,
            w: bounds?.width ?? 600,
            h: bounds?.height ?? 400,
            url: win.url as string,
            fileName: win.title as string | undefined,
            z: win.zIndex as number | undefined,
          });
        }
      }
    });
    return cleanup;
  }, [addWindow]);

  // Save state when main process requests it (before quit)
  useEffect(() => {
    const cleanup = window.electronAPI.onRequestSave(() => {
      const currentWindows = useStore.getState().windows;
      const metadata = currentWindows.map((w) => ({
        id: w.id,
        url: w.url,
        bounds: { x: w.x, y: w.y, width: w.w, height: w.h },
        zIndex: w.z ?? 1,
        title: w.fileName,
      }));
      window.electronAPI.saveStateResponse(metadata);
    });
    return cleanup;
  }, []);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "IFRAME" || target?.tagName === "WEBVIEW") return;

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
      if (e.target instanceof HTMLInputElement) return;
      if ((e.target as HTMLElement).closest("[cmdk-root]")) return;
      if (e.key === "ArrowRight") moveCell(1, 0);
      if (e.key === "ArrowLeft") moveCell(-1, 0);
      if (e.key === "ArrowDown") moveCell(0, 1);
      if (e.key === "ArrowUp") moveCell(0, -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveCell]);

  const normalizeUrl = (value: string) => {
    if (!value) return null;
    if (value.startsWith("file://")) return value;
    if (value.startsWith("katsu://")) return value;
    if (value.startsWith("http://"))
      return `https://${value.slice("http://".length)}`;
    if (value.startsWith("https://")) return value;
    return `https://${value}`;
  };

  const openWindow = (cleanUrl: string) => {
    const newWindowId = crypto.randomUUID();
    addWindow({
      id: newWindowId,
      x: currentCell.x * grid.cellWidth + 100 + Math.random() * 50,
      y: currentCell.y * grid.cellHeight + 100 + Math.random() * 50,
      w: 600,
      h: 400,
      url: cleanUrl,
    });
    setActiveWindow(newWindowId);
  };

  const openSite = () => {
    const cleanUrl = normalizeUrl(urlField);
    if (!cleanUrl) return;
    openWindow(cleanUrl);
    setUrlField("");
  };

  const handleFileOpen = async (files: File[]) => {
    for (const file of files) {
      const { url, fileName, nativeWidth, nativeHeight } =
        await createFilePreview(file);
      const newWindowId = crypto.randomUUID();

      const contentMaxW = grid.cellWidth * 0.9 - WINDOW_BORDER;
      const contentMaxH = grid.cellHeight * 0.9 - WINDOW_BORDER - TITLEBAR_H;
      let w = nativeWidth ?? 700;
      let h = nativeHeight ?? 500;

      if (nativeWidth && nativeHeight) {
        const scale = Math.min(contentMaxW / nativeWidth, contentMaxH / nativeHeight, 1);
        w = Math.round(nativeWidth * scale) + WINDOW_BORDER;
        h = Math.round(nativeHeight * scale) + WINDOW_BORDER + TITLEBAR_H;
      } else {
        w = Math.min(w, contentMaxW) + WINDOW_BORDER;
        h = Math.min(h, contentMaxH) + WINDOW_BORDER + TITLEBAR_H;
      }

      addWindow({
        id: newWindowId,
        x: currentCell.x * grid.cellWidth + (grid.cellWidth - w) / 2,
        y: currentCell.y * grid.cellHeight + (grid.cellHeight - h) / 2,
        w,
        h,
        url,
        fileName,
      });
      setActiveWindow(newWindowId);
    }
  };

  const handleOpenFileDialog = async () => {
    const result = await window.electronAPI.openFile();
    if (!result.canceled && result.filePaths.length > 0) {
      for (const filePath of result.filePaths) {
        const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
        const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
        const rawUrl = `katsu://preview/${encodeURIComponent(filePath)}?raw`;
        const { w: nativeW, h: nativeH } = await getMediaDimensions(rawUrl, ext);
        const contentMaxW = grid.cellWidth * 0.9 - WINDOW_BORDER;
        const contentMaxH = grid.cellHeight * 0.9 - WINDOW_BORDER - TITLEBAR_H;
        let w = 700;
        let h = 500;

        if (nativeW && nativeH) {
          const scale = Math.min(contentMaxW / nativeW, contentMaxH / nativeH, 1);
          w = Math.round(nativeW * scale) + WINDOW_BORDER;
          h = Math.round(nativeH * scale) + WINDOW_BORDER + TITLEBAR_H;
        } else {
          w = Math.min(w, contentMaxW) + WINDOW_BORDER;
          h = Math.min(h, contentMaxH) + WINDOW_BORDER + TITLEBAR_H;
        }

        const newWindowId = crypto.randomUUID();
        addWindow({
          id: newWindowId,
          x: currentCell.x * grid.cellWidth + (grid.cellWidth - w) / 2,
          y: currentCell.y * grid.cellHeight + (grid.cellHeight - h) / 2,
          w,
          h,
          url: `katsu://preview/${encodeURIComponent(filePath)}`,
          fileName,
        });
        setActiveWindow(newWindowId);
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
    </div>
  );
}

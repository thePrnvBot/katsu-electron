import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import type { PreviewType } from "../shared/contract";
import { CameraAnimator } from "./components/camera-animator";
import { CommandMenu } from "./components/command-menu/command-menu";
import { Minimap } from "./components/minimap";
import { PermissionDialog } from "./components/permission-dialog";
import { SearchBar } from "./components/search-bar";
import { TitleBar } from "./components/title-bar";
import { Window } from "./components/window";
import { World } from "./components/world";
import { ARROW_DELTAS, WHEEL_CELL_THRESHOLD } from "./lib/constants";
import { useCameraStore } from "./store/camera-store";
import { usePermissionStore } from "./store/permission-store";
import { useSettingsStore } from "./store/settings-store";
import { useWindowStore } from "./store/window-store";
import {
  createFilePreview,
  createFilePreviewFromPath,
} from "./utils/file-preview";
import { centerBoundsInCell, computeWindowSize } from "./utils/layout";

const KNOWN_SCHEMES = ["file://", "katsu://", "http://", "https://"] as const;

const normalizeUrl = (value: string): string | null => {
  if (!value) {
    return null;
  }
  if (KNOWN_SCHEMES.some((s) => value.startsWith(s))) {
    return value;
  }
  return `https://${value}`;
};

export const App = () => {
  const moveCell = useCameraStore((s) => s.moveCell);
  const currentCell = useCameraStore((s) => s.currentCell);
  const grid = useCameraStore((s) => s.grid);
  // Selector returns a new array only when the set of ids changes.
  const windowIds = useWindowStore(
    useShallow((s) => s.windows.map((w) => w.id))
  );
  const addWindow = useWindowStore((s) => s.addWindow);
  const bringToFront = useWindowStore((s) => s.bringToFront);
  const setActiveWindow = useWindowStore((s) => s.setActiveWindow);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const [urlField, setUrlField] = useState("");
  const wheelAccum = useRef({ x: 0, y: 0 });

  // Load persisted state on mount — parsed at the boundary, no casts.
  useEffect(() => {
    window.electronAPI.setStateLoadedHandler((savedWindows) => {
      savedWindows.forEach((savedWindow) => {
        addWindow({
          fileName: savedWindow.title,
          h: savedWindow.bounds.height,
          id: savedWindow.id,
          previewType: savedWindow.previewType,
          url: savedWindow.url,
          w: savedWindow.bounds.width,
          x: savedWindow.bounds.x,
          y: savedWindow.bounds.y,
          z: savedWindow.zIndex,
        });
      })
    });

    window.electronAPI.setSettingsLoadedHandler((savedSettings) => {
      loadSettings(savedSettings);
    });
  }, [addWindow, loadSettings]);

  // Persist settings whenever they change (e.g. windowPeeking toggle).
  useEffect(() => {
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (state.settings !== prev.settings) {
        void window.electronAPI.saveSettings(state.settings);
      }
    });
    return unsub;
  }, []);

  // Save state when main process requests it (before quit).
  useEffect(() => {
    window.electronAPI.setRequestSaveHandler(() => {
      const currentWindows = useWindowStore.getState().windows;
      const metadata = currentWindows.map((w) => ({
        bounds: { height: w.h, width: w.w, x: w.x, y: w.y },
        id: w.id,
        previewType: w.previewType,
        title: w.fileName,
        url: w.url,
        zIndex: w.z ?? 1,
      }));
      void window.electronAPI.saveStateResponse(metadata);
    });
  }, []);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!(e.target instanceof HTMLElement)) {
        return;
      }
      if (e.target.tagName === "IFRAME" || e.target.tagName === "WEBVIEW") {
        return;
      }

      wheelAccum.current.x += e.deltaX;
      wheelAccum.current.y += e.deltaY;

      if (Math.abs(wheelAccum.current.x) > WHEEL_CELL_THRESHOLD) {
        moveCell(wheelAccum.current.x > 0 ? 1 : -1, 0);
        wheelAccum.current.x = 0;
      }
      if (Math.abs(wheelAccum.current.y) > WHEEL_CELL_THRESHOLD) {
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
      if (e.target instanceof HTMLElement && e.target.closest("[cmdk-root]")) {
        return;
      }
      // Permission dialog is modal — arrow keys must not pan the camera behind it.
      if (usePermissionStore.getState().request) {
        return;
      }
      const delta = ARROW_DELTAS[e.key];
      if (delta) {
        moveCell(...delta);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveCell]);

  const activateWindow = (id: string) => {
    setActiveWindow(id);
    bringToFront(id);
  };

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
    activateWindow(newWindowId);
  };

  const openSite = () => {
    const cleanUrl = normalizeUrl(urlField);
    if (!cleanUrl) {
      return;
    }
    openWindow(cleanUrl);
    setUrlField("");
  };

  const addPreview = (preview: {
    fileName: string;
    previewType: PreviewType;
    url: string;
  }) => {
    const newWindowId = crypto.randomUUID();
    const { w, h } = computeWindowSize(
      undefined,
      undefined,
      grid.cellWidth,
      grid.cellHeight
    );
    const { x, y } = centerBoundsInCell(w, h, grid, currentCell);
    addWindow({
      fileName: preview.fileName,
      h,
      id: newWindowId,
      previewType: preview.previewType,
      url: preview.url,
      w,
      x,
      y,
    });
    activateWindow(newWindowId);
  };

  const handleFileOpen = async (files: File[]) => {
    const previews = await Promise.all(files.map(createFilePreview));
    for (const preview of previews) {
      addPreview(preview);
    }
  };

  const handleOpenFileDialog = async () => {
    const result = await window.electronAPI.openFile();
    if (result.canceled || result.filePaths.length === 0) {
      return;
    }
    const staged = await Promise.all(
      result.filePaths.map((p) => window.electronAPI.stageFile(p))
    );
    for (const { name, path: stagedPath } of staged) {
      addPreview(createFilePreviewFromPath(name, stagedPath));
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
        {windowIds.map((id) => (
          <Window key={id} windowId={id} />
        ))}
      </World>
      <Minimap />
      <PermissionDialog />
    </div>
  );
};

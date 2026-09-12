/** App root: persisted state wiring, camera input, file opening, composition. */

import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import type { PreviewType, Settings } from "../shared/contract";
import { CameraAnimator } from "./components/camera-animator";
import { CommandMenu } from "./components/command-menu/command-menu";
import { Minimap } from "./components/minimap";
import { PermissionDialog } from "./components/permission-dialog";
import { SearchBar } from "./components/search-bar";
import { TitleBar } from "./components/title-bar";
import { Window } from "./components/window";
import { World } from "./components/world";
import { getArrowDelta, WHEEL_CELL_THRESHOLD } from "./lib/constants";
import { useCameraStore } from "./store/camera-store";
import { usePermissionStore } from "./store/permission-store";
import { useSettingsStore } from "./store/settings-store";
import { useWindowStore } from "./store/window-store";
import {
  createFilePreview,
  createFilePreviewFromPath,
} from "./utils/file-preview";
import { ignoreFailure } from "./utils/ignore-failure";
import { centerBoundsInCell, computeWindowSize } from "./utils/layout";
import { scheduleRestoreHydration } from "./utils/window-hydration";
import {
  windowFromMetadata,
  windowMetadataFromWindow,
} from "./utils/window-metadata";

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

const processSequentially = async <T,>(
  items: readonly T[],
  operation: (item: T) => Promise<void>,
  index = 0
): Promise<number> => {
  if (index >= items.length) {
    return 0;
  }
  const item = items[index];
  if (item === undefined) {
    return 0;
  }

  let failed = 0;
  try {
    await operation(item);
  } catch {
    failed = 1;
  }
  return failed + (await processSequentially(items, operation, index + 1));
};

const isWindowContent = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  target.closest("[data-window-content]") !== null;

const isTitleBar = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest(".titlebar") !== null;

export const App = () => {
  const moveCell = useCameraStore((s) => s.moveCell);
  const currentCell = useCameraStore((s) => s.currentCell);
  const grid = useCameraStore((s) => s.grid);
  // Selector returns a new array only when the set of ids changes.
  const windowIds = useWindowStore(useShallow((s) => Object.keys(s.windows)));
  const addWindow = useWindowStore((s) => s.addWindow);
  const bringToFront = useWindowStore((s) => s.bringToFront);
  const setActiveWindow = useWindowStore((s) => s.setActiveWindow);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const [urlField, setUrlField] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const wheelAccum = useRef({ x: 0, y: 0 });

  // Load persisted state on mount — parsed at the boundary, no casts.
  // Restored windows start suspended and hydrate outward from the active
  // cell so app start does not mount every webview and PTY at once.
  useEffect(() => {
    window.electronAPI.setStateLoadedHandler((savedWindows) => {
      for (const savedWindow of savedWindows) {
        addWindow({ ...windowFromMetadata(savedWindow), live: false });
      }
      scheduleRestoreHydration();
    });

    window.electronAPI.setSettingsLoadedHandler((savedSettings) => {
      loadSettings(savedSettings);
    });
  }, [addWindow, loadSettings]);

  // Persist settings whenever they change (e.g. windowPeeking toggle).
  // Writes are serialized: rapid toggles each capture their snapshot up
  // front, so a slow older write can never land after a newer one.
  useEffect(() => {
    const persistSettings = async (settings: Settings): Promise<void> => {
      try {
        await window.electronAPI.saveSettings(settings);
      } catch {
        setStatusMessage("Settings could not be saved.");
      }
    };

    let writeQueue: Promise<void> = Promise.resolve();
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (state.settings !== prev.settings) {
        const snapshot = state.settings;
        writeQueue = (async () => {
          await writeQueue;
          await persistSettings(snapshot);
        })();
      }
    });
    return unsub;
  }, []);

  // Save state when main process requests it (before quit).
  useEffect(() => {
    window.electronAPI.setRequestSaveHandler(() => {
      const currentWindows = Object.values(useWindowStore.getState().windows);
      // Preview windows reference blob:/katsu:// temp files that are wiped
      // on relaunch — persisting them would only restore dead windows.
      const persistable = currentWindows.filter(
        (w) => w.previewType === undefined
      );
      const metadata = persistable.map(windowMetadataFromWindow);
      void ignoreFailure(window.electronAPI.saveStateResponse(metadata));
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
      // Scrollable window content (previews, terminal) handles its own scroll.
      if (isWindowContent(e.target) || isTitleBar(e.target)) {
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
      // Terminal and other window content own arrow keys (xterm history,
      // scrolling); the titlebar owns Shift/Alt arrow nudging.
      if (isWindowContent(e.target) || isTitleBar(e.target)) {
        return;
      }
      // Permission dialog is modal — arrow keys must not pan the camera behind it.
      if (usePermissionStore.getState().requests.length > 0) {
        return;
      }
      const delta = getArrowDelta(e.key);
      if (delta) {
        moveCell(delta[0], delta[1]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveCell]);

  // Grid cells size to the viewport, so a native resize (window resize,
  // maximize/unmaximize) must rescale the grid or maximized windows and
  // camera targets drift. Debounced so drag-resize doesn't thrash state.
  const refreshGridSize = useCameraStore((s) => s.refreshGridSize);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(refreshGridSize, 100);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [refreshGridSize]);

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

  const openTerminal = () => {
    const newWindowId = crypto.randomUUID();
    const { w, h } = computeWindowSize(
      undefined,
      undefined,
      grid.cellWidth,
      grid.cellHeight
    );
    const { x, y } = centerBoundsInCell(w, h, grid, currentCell);
    addWindow({
      fileName: "Terminal",
      h,
      id: newWindowId,
      kind: "terminal",
      url: "",
      w,
      x,
      y,
    });
    activateWindow(newWindowId);
  };

  const handleFileOpen = async (files: File[]) => {
    setStatusMessage(null);
    const failedCount = await processSequentially(files, async (file) => {
      addPreview(await createFilePreview(file));
    });
    if (failedCount > 0) {
      setStatusMessage(`${failedCount} file(s) could not be opened.`);
    }
  };

  const handleOpenFileDialog = async () => {
    setStatusMessage(null);
    let result: Awaited<ReturnType<typeof window.electronAPI.openFile>>;
    try {
      result = await window.electronAPI.openFile();
    } catch {
      setStatusMessage("The file dialog could not be opened.");
      return;
    }
    if (result.canceled || result.filePaths.length === 0) {
      return;
    }
    // A failed stage (missing/duplicate grant) skips only that file.
    const failedCount = await processSequentially(
      result.filePaths,
      async (filePath) => {
        const staged = await window.electronAPI.stageFile(filePath);
        addPreview(createFilePreviewFromPath(staged.name, staged.path));
      }
    );
    if (failedCount > 0) {
      setStatusMessage(`${failedCount} file(s) could not be opened.`);
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden">
      <CameraAnimator />
      <TitleBar />
      <CommandMenu openTerminal={openTerminal} />
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
      {statusMessage && (
        <button
          type="button"
          className="fixed bottom-4 left-1/2 z-[100000] -translate-x-1/2 rounded-full border border-white/10 bg-[#222] px-4 py-2 text-sm text-white/80 shadow-lg"
          onClick={() => setStatusMessage(null)}
          aria-label="Dismiss status message"
        >
          {statusMessage}
        </button>
      )}
    </div>
  );
};

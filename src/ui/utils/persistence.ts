import type { Window } from "../store/windowStore";

const DEBOUNCE_MS = 500;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function debouncedSaveState(windows: Window[]) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    const metadata = windows.map((w) => ({
      id: w.id,
      url: w.url,
      bounds: { x: w.x, y: w.y, width: w.w, height: w.h },
      zIndex: w.z ?? 1,
      title: w.fileName,
    }));

    window.electronAPI.saveState(metadata).catch((err: unknown) => {
      console.error("Failed to save state:", err);
    });
  }, DEBOUNCE_MS);
}

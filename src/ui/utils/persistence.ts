import type { Window } from "../store/window-store";

const DEBOUNCE_MS = 500;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export const debouncedSaveState = (windows: Window[]) => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(async () => {
    const metadata = windows.map((w) => ({
      bounds: { height: w.h, width: w.w, x: w.x, y: w.y },
      id: w.id,
      title: w.fileName,
      url: w.url,
      zIndex: w.z ?? 1,
    }));

    try {
      await window.electronAPI.saveState(metadata);
    } catch (error: unknown) {
      console.error("Failed to save state:", error);
    }
  }, DEBOUNCE_MS);
};

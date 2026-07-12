import type { Settings, Window } from "../store/window-store";

const DEBOUNCE_MS = 500;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let saveSettingsTimeout: ReturnType<typeof setTimeout> | null = null;

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

export const debouncedSaveSettings = (settings: Settings) => {
  if (saveSettingsTimeout) {
    clearTimeout(saveSettingsTimeout);
  }

  saveSettingsTimeout = setTimeout(async () => {
    try {
      await window.electronAPI.saveSettings(settings);
    } catch (error: unknown) {
      console.error("Failed to save settings:", error);
    }
  }, DEBOUNCE_MS);
};

export const loadSettingsFromDisk = (): Promise<Settings> =>
  window.electronAPI.loadSettings() as Promise<Settings>;

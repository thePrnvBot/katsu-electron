import { create } from "zustand";

interface Settings {
  readonly keepWindowsAlive: boolean;
  readonly windowPeeking: boolean;
}

interface SettingsState {
  settings: Settings;
  loadSettings: (settings: Settings) => void;
  toggleKeepWindowsAlive: () => void;
  toggleWindowPeeking: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  loadSettings: (settings) => set({ settings }),

  settings: { keepWindowsAlive: false, windowPeeking: false },

  toggleKeepWindowsAlive: () =>
    set((s) => ({
      settings: {
        ...s.settings,
        keepWindowsAlive: !s.settings.keepWindowsAlive,
      },
    })),

  toggleWindowPeeking: () =>
    set((s) => ({
      settings: {
        ...s.settings,
        windowPeeking: !s.settings.windowPeeking,
      },
    })),
}));

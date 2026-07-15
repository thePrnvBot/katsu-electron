import { create } from "zustand";

interface Settings {
  readonly windowPeeking: boolean;
}

interface SettingsState {
  settings: Settings;
  loadSettings: (settings: Settings) => void;
  toggleWindowPeeking: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  loadSettings: (settings) => set({ settings }),

  settings: { windowPeeking: false },

  toggleWindowPeeking: () =>
    set((s) => ({
      settings: {
        ...s.settings,
        windowPeeking: !s.settings.windowPeeking,
      },
    })),
}));

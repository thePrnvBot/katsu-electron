/** User settings with load and toggles. */

import { create } from "zustand";

import { DEFAULT_SETTINGS } from "../../shared/contract";
import type { ArtifactProviderId, Settings } from "../../shared/contract";

interface SettingsState {
  settings: Settings;
  loadSettings: (settings: Settings) => void;
  setArtifactProvider: (providerId: ArtifactProviderId) => void;
  toggleKeepWindowsAlive: () => void;
  toggleWindowPeeking: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  loadSettings: (settings) => set({ settings }),

  setArtifactProvider: (artifactProviderId) =>
    set((s) => ({
      settings: { ...s.settings, artifactProviderId },
    })),

  settings: DEFAULT_SETTINGS,

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

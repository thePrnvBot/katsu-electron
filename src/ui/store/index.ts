import {
  debouncedSaveSettings,
  debouncedSaveState,
} from "../utils/persistence";
import { useSettingsStore } from "./settings-store";
import { useWindowStore } from "./window-store";

export { useCameraStore } from "./camera-store";
export { useSettingsStore } from "./settings-store";
export { useWindowStore } from "./window-store";
export type { Window, Bounds } from "./window-store";
export type { Grid } from "./camera-store";
export type { Settings } from "./settings-store";

// Wire up persistence subscriptions after all stores are initialized
useWindowStore.subscribe((state, prevState) => {
  if (state.windows !== prevState.windows) {
    debouncedSaveState(state.windows);
  }
});

useSettingsStore.subscribe((state, prevState) => {
  if (state.settings !== prevState.settings) {
    debouncedSaveSettings(state.settings);
  }
});

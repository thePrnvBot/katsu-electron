import { create } from "zustand";

import { MAX_WARM_WEBVIEWS } from "../lib/constants";

interface WarmWebviewsState {
  /** Webview window ids whose guest stays mounted, most recent first. */
  warmIds: readonly string[];
  /** Mark a window recently visible; trims the pool to capacity. */
  warm: (id: string) => void;
  /** Drop a window from the pool (its window was removed). */
  forget: (id: string) => void;
}

/**
 * Bounded pool of guest webviews that stay mounted (hidden) after their
 * window leaves the camera, so returning to a recently visited cell reuses
 * the renderer instead of reloading the page. Evicted windows reload on
 * return — keeping every renderer alive forever would not bound memory.
 */
export const useWarmWebviewsStore = create<WarmWebviewsState>((set) => ({
  forget: (id) =>
    set((s) => ({ warmIds: s.warmIds.filter((existing) => existing !== id) })),
  warm: (id) =>
    set((s) => {
      if (s.warmIds[0] === id) {
        return s;
      }
      return {
        warmIds: [id, ...s.warmIds.filter((existing) => existing !== id)].slice(
          0,
          MAX_WARM_WEBVIEWS
        ),
      };
    }),
  warmIds: [],
}));

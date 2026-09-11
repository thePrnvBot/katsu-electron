import { create } from "zustand";

import type { Bounds, PreviewType, WindowKind } from "../../shared/contract";
import {
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_X,
  DEFAULT_WINDOW_Y,
} from "../lib/constants";
import { revokePreviewUrl } from "../utils/file-preview";
import type { WindowLayout } from "../utils/window-layouts";
import { resolveLayout } from "../utils/window-layouts";
import { useCameraStore } from "./camera-store";

export interface Window {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly z?: number;
  readonly url: string;
  readonly fileName?: string;
  readonly maximized?: boolean;
  readonly prevBounds?: Bounds;
  readonly previewType?: PreviewType;
  /** Defaults to "webview" when absent. */
  readonly kind?: WindowKind;
  /**
   * Content lifecycle: false keeps the window as a cheap chrome-only shell
   * (restored windows hydrate later); undefined/true mounts content.
   */
  readonly live?: boolean;
}

interface WindowState {
  /** Keyed by window id so per-window selectors stay O(1). */
  windows: Record<string, Window>;
  activeWindowId: string | null;

  addWindow: (w: Window) => void;
  updateWindow: (id: string, patch: Partial<Window>) => void;
  removeWindow: (id: string) => void;
  closeAllWindows: () => void;
  /** Swap the whole window set (workspace load); releases preview URLs. */
  replaceWindows: (windows: Window[]) => void;
  setActiveWindow: (id: string | null) => void;
  bringToFront: (id: string) => void;
  maximizeWindow: (id: string) => void;
  /** Mount a suspended window's content (restore hydration). */
  hydrateWindow: (id: string) => void;
  setWindowLayout: (id: string, layout: WindowLayout) => void;
}

const replaceOne = (
  windows: Record<string, Window>,
  id: string,
  next: Window
) => ({ ...windows, [id]: next });

export const useWindowStore = create<WindowState>((set) => ({
  activeWindowId: null,
  addWindow: (w) =>
    set((s) => ({
      windows: { ...s.windows, [w.id]: w },
    })),
  bringToFront: (id) =>
    set((s) => {
      const target = s.windows[id];
      if (!target) {
        return s;
      }
      const maxZ = Math.max(
        ...Object.values(s.windows).map((w) => w.z ?? 0),
        0
      );
      return {
        windows: replaceOne(s.windows, id, { ...target, z: maxZ + 1 }),
      };
    }),
  closeAllWindows: () =>
    set((s) => {
      for (const w of Object.values(s.windows)) {
        revokePreviewUrl(w.url);
      }
      return {
        activeWindowId: null,
        windows: {},
      };
    }),
  hydrateWindow: (id) =>
    set((s) => {
      const target = s.windows[id];
      if (!target) {
        return s;
      }
      return {
        windows: replaceOne(s.windows, id, { ...target, live: true }),
      };
    }),
  maximizeWindow: (id) =>
    set((s) => {
      const target = s.windows[id];
      if (!target) {
        return s;
      }

      if (target.maximized) {
        const pb = target.prevBounds ?? {
          height: DEFAULT_WINDOW_HEIGHT,
          width: DEFAULT_WINDOW_WIDTH,
          x: DEFAULT_WINDOW_X,
          y: DEFAULT_WINDOW_Y,
        };
        return {
          windows: replaceOne(s.windows, id, {
            ...target,
            h: pb.height,
            maximized: false,
            prevBounds: undefined,
            w: pb.width,
            x: pb.x,
            y: pb.y,
          }),
        };
      }

      // Anchor to the settled cell, not the animated camera position.
      const { currentCell, grid } = useCameraStore.getState();
      return {
        windows: replaceOne(s.windows, id, {
          ...target,
          // The window height includes its own titlebar — fill the cell
          // entirely so maximized windows have no bottom gap.
          h: grid.cellHeight,
          maximized: true,
          prevBounds: {
            height: target.h,
            width: target.w,
            x: target.x,
            y: target.y,
          },
          w: grid.cellWidth,
          x: currentCell.x * grid.cellWidth,
          y: currentCell.y * grid.cellHeight,
        }),
      };
    }),
  removeWindow: (id) =>
    set((s) => {
      const target = s.windows[id];
      if (target) {
        revokePreviewUrl(target.url);
      }
      return {
        activeWindowId: s.activeWindowId === id ? null : s.activeWindowId,
        windows: Object.fromEntries(
          Object.entries(s.windows).filter(([key]) => key !== id)
        ),
      };
    }),
  replaceWindows: (windows) =>
    set((s) => {
      for (const w of Object.values(s.windows)) {
        revokePreviewUrl(w.url);
      }
      return {
        activeWindowId: null,
        windows: Object.fromEntries(windows.map((w) => [w.id, w])),
      };
    }),
  setActiveWindow: (id) => set({ activeWindowId: id }),
  setWindowLayout: (id, layout) =>
    set((s) => {
      const target = s.windows[id];
      if (!target) {
        return s;
      }
      const { grid, currentCell } = useCameraStore.getState();
      const bounds = resolveLayout(layout, grid);
      return {
        windows: replaceOne(s.windows, id, {
          ...target,
          h: bounds.height,
          maximized: false,
          w: bounds.width,
          x: currentCell.x * grid.cellWidth + bounds.x,
          y: currentCell.y * grid.cellHeight + bounds.y,
        }),
      };
    }),
  updateWindow: (id, patch) =>
    set((s) => {
      const target = s.windows[id];
      if (!target) {
        return s;
      }
      return {
        windows: replaceOne(s.windows, id, { ...target, ...patch }),
      };
    }),
  windows: {},
}));

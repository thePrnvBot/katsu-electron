import { create } from "zustand";

import type { Bounds, PreviewType } from "../../shared/contract";
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
}

interface WindowState {
  windows: Window[];
  activeWindowId: string | null;

  addWindow: (w: Window) => void;
  updateWindow: (id: string, patch: Partial<Window>) => void;
  removeWindow: (id: string) => void;
  setActiveWindow: (id: string | null) => void;
  bringToFront: (id: string) => void;
  maximizeWindow: (id: string) => void;
  setWindowLayout: (id: string, layout: WindowLayout) => void;
}

export const useWindowStore = create<WindowState>((set) => ({
  activeWindowId: null,
  addWindow: (w) =>
    set((s) => ({
      windows: [...s.windows, w],
    })),
  bringToFront: (id) =>
    set((s) => {
      const maxZ = Math.max(...s.windows.map((w) => w.z ?? 0), 0);
      return {
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, z: maxZ + 1 } : w
        ),
      };
    }),
  maximizeWindow: (id) =>
    set((s) => {
      const currentWindow = s.windows.find((window) => window.id === id);
      if (!currentWindow) {
        return s;
      }

      if (currentWindow.maximized) {
        const pb = currentWindow.prevBounds ?? {
          height: DEFAULT_WINDOW_HEIGHT,
          width: DEFAULT_WINDOW_WIDTH,
          x: DEFAULT_WINDOW_X,
          y: DEFAULT_WINDOW_Y,
        };
        return {
          windows: s.windows.map((window) =>
            window.id === id
              ? {
                  ...window,
                  h: pb.height,
                  maximized: false,
                  prevBounds: undefined,
                  w: pb.width,
                  x: pb.x,
                  y: pb.y,
                }
              : window
          ),
        };
      }

      const { camera, grid } = useCameraStore.getState();
      const cx = camera.x;
      const cy = camera.y;
      return {
        windows: s.windows.map((window) =>
          window.id === id
            ? {
                ...window,
                h: grid.cellHeight,
                maximized: true,
                prevBounds: {
                  height: window.h,
                  width: window.w,
                  x: window.x,
                  y: window.y,
                },
                w: grid.cellWidth,
                x: cx,
                y: cy,
              }
            : window
        ),
      };
    }),
  removeWindow: (id) =>
    set((s) => {
      const currentWindow = s.windows.find((window) => window.id === id);
      if (currentWindow) {
        revokePreviewUrl(currentWindow.url);
      }
      return {
        activeWindowId: s.activeWindowId === id ? null : s.activeWindowId,
        windows: s.windows.filter((window) => window.id !== id),
      };
    }),
  setActiveWindow: (id) => set({ activeWindowId: id }),
  setWindowLayout: (id, layout) => {
    const { grid, currentCell } = useCameraStore.getState();
    const bounds = resolveLayout(layout, grid);
    const cx = currentCell.x * grid.cellWidth;
    const cy = currentCell.y * grid.cellHeight;

    set((s) => ({
      windows: s.windows.map((window) =>
        window.id === id
          ? {
              ...window,
              h: bounds.height,
              maximized: false,
              w: bounds.width,
              x: cx + bounds.x,
              y: cy + bounds.y,
            }
          : window
      ),
    }));
  },
  updateWindow: (id, patch) =>
    set((s) => ({
      windows: s.windows.map((window) =>
        window.id === id ? { ...window, ...patch } : window
      ),
    })),
  windows: [],
}));

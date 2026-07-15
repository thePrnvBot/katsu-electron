import { create } from "zustand";

import type { PreviewType } from "../utils/file-preview";
import { revokeBlobUrl } from "../utils/file-preview";
import type { WindowLayout } from "../utils/window-layouts";
import { resolveLayout } from "../utils/window-layouts";
import { useCameraStore } from "./camera-store";

export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

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
      const w = s.windows.find((x) => x.id === id);
      if (!w) {
        return s;
      }

      if (w.maximized) {
        const pb = w.prevBounds ?? { h: 400, w: 600, x: 100, y: 100 };
        return {
          windows: s.windows.map((x) =>
            x.id === id
              ? {
                  ...x,
                  h: pb.h,
                  maximized: false,
                  prevBounds: undefined,
                  w: pb.w,
                  x: pb.x,
                  y: pb.y,
                }
              : x
          ),
        };
      }

      const { currentCell, grid } = useCameraStore.getState();
      const cx = currentCell.x * grid.cellWidth;
      const cy = currentCell.y * grid.cellHeight;
      return {
        windows: s.windows.map((x) =>
          x.id === id
            ? {
                ...x,
                h: grid.cellHeight,
                maximized: true,
                prevBounds: { h: x.h, w: x.w, x: x.x, y: x.y },
                w: grid.cellWidth,
                x: cx,
                y: cy,
              }
            : x
        ),
      };
    }),
  removeWindow: (id) =>
    set((s) => {
      const win = s.windows.find((w) => w.id === id);
      if (win) {
        revokeBlobUrl(win.url);
      }
      return {
        activeWindowId: s.activeWindowId === id ? null : s.activeWindowId,
        windows: s.windows.filter((w) => w.id !== id),
      };
    }),
  setActiveWindow: (id) => set({ activeWindowId: id }),
  setWindowLayout: (id, layout) => {
    const { grid, currentCell } = useCameraStore.getState();
    const bounds = resolveLayout(layout, grid);
    const cx = currentCell.x * grid.cellWidth;
    const cy = currentCell.y * grid.cellHeight;

    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              h: bounds.h,
              maximized: false,
              w: bounds.w,
              x: cx + bounds.x,
              y: cy + bounds.y,
            }
          : w
      ),
    }));
  },
  updateWindow: (id, patch) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    })),
  windows: [],
}));

import { create } from "zustand";

import { revokeBlobUrl } from "../utils/file-preview";
import { debouncedSaveState } from "../utils/persistence";
import { resolveLayout } from "../utils/window-layouts";
import type { WindowLayout } from "../utils/window-layouts";

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Window {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
  url: string;
  fileName?: string;
  maximized?: boolean;
  prevBounds?: Bounds;
}

export interface State {
  windows: Window[];
  camera: { x: number; y: number };
  cameraTarget: { x: number; y: number };
  activeWindowId: string | null;
  grid: { cols: number; rows: number; cellWidth: number; cellHeight: number };
  currentCell: { x: number; y: number };

  addWindow: (w: Window) => void;
  updateWindow: (id: string, patch: Partial<Window>) => void;
  removeWindow: (id: string) => void;
  moveToCell: (x: number, y: number) => void;
  moveCell: (dx: number, dy: number) => void;
  setActiveWindow: (id: string | null) => void;
  maximizeWindow: (id: string) => void;
  centerOnWindow: (id: string) => void;
  bringToFront: (id: string) => void;
  setWindowLayout: (id: string, layout: WindowLayout) => void;
}

const COLS = 10;
const ROWS = 10;

export const useStore = create<State>((set, get) => ({
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
  camera: { x: 0, y: 0 },
  cameraTarget: { x: 0, y: 0 },
  centerOnWindow: (id) => {
    const w = get().windows.find((x) => x.id === id);
    if (!w) {
      return;
    }

    const { grid } = get();
    const cx = Math.floor((w.x + w.w / 2) / grid.cellWidth);
    const cy = Math.floor((w.y + w.h / 2) / grid.cellHeight);

    set({
      cameraTarget: {
        x: Math.max(0, Math.min(grid.cols - 1, cx)) * grid.cellWidth,
        y: Math.max(0, Math.min(grid.rows - 1, cy)) * grid.cellHeight,
      },
      currentCell: {
        x: Math.max(0, Math.min(grid.cols - 1, cx)),
        y: Math.max(0, Math.min(grid.rows - 1, cy)),
      },
    });
  },
  currentCell: { x: 0, y: 0 },
  grid: {
    cellHeight: typeof window === "undefined" ? 900 : window.innerHeight,
    cellWidth: typeof window === "undefined" ? 1400 : window.innerWidth,
    cols: COLS,
    rows: ROWS,
  },
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

      const cx = s.currentCell.x * s.grid.cellWidth;
      const cy = s.currentCell.y * s.grid.cellHeight;
      return {
        windows: s.windows.map((x) =>
          x.id === id
            ? {
                ...x,
                h: s.grid.cellHeight,
                maximized: true,
                prevBounds: { h: x.h, w: x.w, x: x.x, y: x.y },
                w: s.grid.cellWidth,
                x: cx,
                y: cy,
              }
            : x
        ),
      };
    }),
  moveCell: (dx, dy) => {
    const { currentCell, grid } = get();
    const nx = Math.max(0, Math.min(grid.cols - 1, currentCell.x + dx));
    const ny = Math.max(0, Math.min(grid.rows - 1, currentCell.y + dy));
    set({
      cameraTarget: { x: nx * grid.cellWidth, y: ny * grid.cellHeight },
      currentCell: { x: nx, y: ny },
    });
  },
  moveToCell: (x, y) => {
    const { grid } = get();
    const cx = Math.max(0, Math.min(grid.cols - 1, x));
    const cy = Math.max(0, Math.min(grid.rows - 1, y));
    set({
      cameraTarget: { x: cx * grid.cellWidth, y: cy * grid.cellHeight },
      currentCell: { x: cx, y: cy },
    });
  },
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
    const { grid } = get();
    const bounds = resolveLayout(layout, grid);
    const cx = get().currentCell.x * grid.cellWidth;
    const cy = get().currentCell.y * grid.cellHeight;

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

// Subscribe to window changes and debounce saves
useStore.subscribe((state, prevState) => {
  if (state.windows !== prevState.windows) {
    debouncedSaveState(state.windows);
  }
});

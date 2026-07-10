import { create } from "zustand";
import { resolveLayout, type WindowLayout } from "../utils/windowLayouts";
import { revokeBlobUrl } from "../utils/filePreview";
import { debouncedSaveState } from "../utils/persistence";

export type Bounds = { x: number; y: number; w: number; h: number };

export type Window = {
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
};

export type State = {
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
};

const COLS = 10;
const ROWS = 10;

export const useStore = create<State>((set, get) => ({
  windows: [],
  camera: { x: 0, y: 0 },
  cameraTarget: { x: 0, y: 0 },
  activeWindowId: null,
  grid: {
    cols: COLS,
    rows: ROWS,
    cellWidth: typeof window !== "undefined" ? window.innerWidth : 1400,
    cellHeight: typeof window !== "undefined" ? window.innerHeight : 900,
  },
  currentCell: { x: 0, y: 0 },

  addWindow: (w) =>
    set((s) => ({
      windows: [...s.windows, w],
    })),

  updateWindow: (id, patch) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    })),

  removeWindow: (id) =>
    set((s) => {
      const win = s.windows.find((w) => w.id === id);
      if (win) revokeBlobUrl(win.url);
      return {
        windows: s.windows.filter((w) => w.id !== id),
        activeWindowId: s.activeWindowId === id ? null : s.activeWindowId,
      };
    }),

  moveToCell: (x, y) => {
    const { grid } = get();
    const cx = Math.max(0, Math.min(grid.cols - 1, x));
    const cy = Math.max(0, Math.min(grid.rows - 1, y));
    set({
      currentCell: { x: cx, y: cy },
      cameraTarget: { x: cx * grid.cellWidth, y: cy * grid.cellHeight },
    });
  },

  moveCell: (dx, dy) => {
    const { currentCell, grid } = get();
    const nx = Math.max(0, Math.min(grid.cols - 1, currentCell.x + dx));
    const ny = Math.max(0, Math.min(grid.rows - 1, currentCell.y + dy));
    set({
      currentCell: { x: nx, y: ny },
      cameraTarget: { x: nx * grid.cellWidth, y: ny * grid.cellHeight },
    });
  },

  setActiveWindow: (id) => set({ activeWindowId: id }),

  maximizeWindow: (id) =>
    set((s) => {
      const w = s.windows.find((x) => x.id === id);
      if (!w) return s;

      if (w.maximized) {
        const pb = w.prevBounds ?? { x: 100, y: 100, w: 600, h: 400 };
        return {
          windows: s.windows.map((x) =>
            x.id === id
              ? {
                  ...x,
                  x: pb.x,
                  y: pb.y,
                  w: pb.w,
                  h: pb.h,
                  maximized: false,
                  prevBounds: undefined,
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
                prevBounds: { x: x.x, y: x.y, w: x.w, h: x.h },
                x: cx,
                y: cy,
                w: s.grid.cellWidth,
                h: s.grid.cellHeight,
                maximized: true,
              }
            : x
        ),
      };
    }),

  centerOnWindow: (id) => {
    const w = get().windows.find((x) => x.id === id);
    if (!w) return;

    const { grid } = get();
    const cx = Math.floor((w.x + w.w / 2) / grid.cellWidth);
    const cy = Math.floor((w.y + w.h / 2) / grid.cellHeight);

    set({
      currentCell: {
        x: Math.max(0, Math.min(grid.cols - 1, cx)),
        y: Math.max(0, Math.min(grid.rows - 1, cy)),
      },
      cameraTarget: {
        x: Math.max(0, Math.min(grid.cols - 1, cx)) * grid.cellWidth,
        y: Math.max(0, Math.min(grid.rows - 1, cy)) * grid.cellHeight,
      },
    });
  },

  bringToFront: (id) =>
    set((s) => {
      const maxZ = Math.max(...s.windows.map((w) => w.z ?? 0), 0);
      return {
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, z: maxZ + 1 } : w
        ),
      };
    }),

  setWindowLayout: (id, layout) => {
    const grid = get().grid;
    const bounds = resolveLayout(layout, grid);
    const cx = get().currentCell.x * grid.cellWidth;
    const cy = get().currentCell.y * grid.cellHeight;

    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              x: cx + bounds.x,
              y: cy + bounds.y,
              w: bounds.w,
              h: bounds.h,
              maximized: false,
            }
          : w
      ),
    }));
  },
}));

// Subscribe to window changes and debounce saves
useStore.subscribe((state, prevState) => {
  if (state.windows !== prevState.windows) {
    debouncedSaveState(state.windows);
  }
});

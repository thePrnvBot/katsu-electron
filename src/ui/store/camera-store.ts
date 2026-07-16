import { create } from "zustand";

import { APP_TITLEBAR_HEIGHT, GRID_COLS, GRID_ROWS } from "../lib/constants";

interface Grid {
  readonly cols: number;
  readonly rows: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
}

interface CameraState {
  camera: { readonly x: number; readonly y: number };
  cameraTarget: { readonly x: number; readonly y: number };
  grid: Grid;
  currentCell: { readonly x: number; readonly y: number };

  moveToCell: (x: number, y: number) => void;
  moveCell: (dx: number, dy: number) => void;
  refreshGridSize: () => void;
  setCameraTarget: (x: number, y: number) => void;
  setCamera: (x: number, y: number) => void;
}

export const useCameraStore = create<CameraState>((set, get) => ({
  camera: { x: 0, y: 0 },
  cameraTarget: { x: 0, y: 0 },
  currentCell: { x: 0, y: 0 },
  grid: {
    cellHeight:
      typeof window === "undefined"
        ? 900 - APP_TITLEBAR_HEIGHT
        : window.innerHeight - APP_TITLEBAR_HEIGHT,
    cellWidth: typeof window === "undefined" ? 1400 : window.innerWidth,
    cols: GRID_COLS,
    rows: GRID_ROWS,
  },
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
  refreshGridSize: () =>
    set((s) => {
      const cellWidth = window.innerWidth;
      const cellHeight = window.innerHeight - APP_TITLEBAR_HEIGHT;
      const cx = s.currentCell.x * cellWidth;
      const cy = s.currentCell.y * cellHeight;
      return {
        cameraTarget: { x: cx, y: cy },
        grid: {
          ...s.grid,
          cellHeight,
          cellWidth,
        },
      };
    }),
  setCamera: (x, y) => set({ camera: { x, y } }),
  setCameraTarget: (x, y) => set({ cameraTarget: { x, y } }),
}));

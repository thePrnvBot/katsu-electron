/** Camera and grid state: pan targets and viewport-sized cells. */

import { create } from "zustand";

import { APP_TITLEBAR_HEIGHT, GRID_COLS, GRID_ROWS } from "../lib/constants";

/**
 * Usable viewport size: when the borderless window covers the whole monitor
 * it extends under the taskbar, so clamp to the OS work area (screen minus
 * taskbar) to keep window content above it. A normal window is smaller than
 * the work area, so `Math.min` leaves it untouched.
 */
const usableWidth = (): number =>
  Math.min(window.innerWidth, window.screen.availWidth);

const usableHeight = (): number =>
  Math.min(window.innerHeight, window.screen.availHeight);

interface Grid {
  readonly cols: number;
  readonly rows: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
}

interface CameraState {
  camera: { readonly x: number; readonly y: number };
  cameraTarget: { readonly x: number; readonly y: number };
  /** The cell the camera has actually reached — lags currentCell during a
   * pan so distance-based mount decisions flip once per cell step, never
   * mid-animation. */
  settledCell: { readonly x: number; readonly y: number };
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
      (globalThis.window ? usableHeight() : 900) - APP_TITLEBAR_HEIGHT,
    cellWidth: globalThis.window ? usableWidth() : 1400,
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
      const cellWidth = usableWidth();
      const cellHeight = usableHeight() - APP_TITLEBAR_HEIGHT;
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
  settledCell: { x: 0, y: 0 },
}));

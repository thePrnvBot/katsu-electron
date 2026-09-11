import {
  DEFAULT_CONTENT_HEIGHT,
  DEFAULT_CONTENT_WIDTH,
  WINDOW_BORDER,
  WINDOW_TITLEBAR_HEIGHT,
} from "../lib/constants";
import type { Window as WindowData } from "../store/window-store";

export interface Size {
  readonly h: number;
  readonly w: number;
}

/** Top-left position that centers a w×h window inside the given cell. */
export const centerBoundsInCell = (
  w: number,
  h: number,
  grid: { cellWidth: number; cellHeight: number },
  cell: { x: number; y: number }
) => ({
  x: cell.x * grid.cellWidth + (grid.cellWidth - w) / 2,
  y: cell.y * grid.cellHeight + (grid.cellHeight - h) / 2,
});

/**
 * Compute the displayed window size for a media element,
 * scaling down to fit within the cell while preserving aspect ratio.
 */
export const computeWindowSize = (
  nativeWidth: number | undefined,
  nativeHeight: number | undefined,
  cellWidth: number,
  cellHeight: number
): Size => {
  const contentMaxW = cellWidth * 0.9 - WINDOW_BORDER;
  const contentMaxH = cellHeight * 0.9 - WINDOW_BORDER - WINDOW_TITLEBAR_HEIGHT;

  if (nativeWidth && nativeHeight) {
    const scale = Math.min(
      contentMaxW / nativeWidth,
      contentMaxH / nativeHeight,
      1
    );
    return {
      h:
        Math.round(nativeHeight * scale) +
        WINDOW_BORDER +
        WINDOW_TITLEBAR_HEIGHT,
      w: Math.round(nativeWidth * scale) + WINDOW_BORDER,
    };
  }

  const defaultW = DEFAULT_CONTENT_WIDTH;
  const defaultH = DEFAULT_CONTENT_HEIGHT;
  return {
    h: Math.min(defaultH, contentMaxH) + WINDOW_BORDER + WINDOW_TITLEBAR_HEIGHT,
    w: Math.min(defaultW, contentMaxW) + WINDOW_BORDER,
  };
};

/** Grid cell containing the center of the given window bounds. */
export const windowCenterCell = (
  window: {
    readonly h: number;
    readonly w: number;
    readonly x: number;
    readonly y: number;
  },
  grid: { readonly cellHeight: number; readonly cellWidth: number }
) => ({
  x: Math.floor((window.x + window.w / 2) / grid.cellWidth),
  y: Math.floor((window.y + window.h / 2) / grid.cellHeight),
});

/**
 * Order windows outward from the active cell in a clockwise spiral:
 * right, bottom-right, bottom, bottom-left, left, top-left, top,
 * top-right, then the next ring. Screens have +y pointing down, so
 * clockwise equals an increasing atan2 angle measured from east.
 */
const angleFromEast = (dx: number, dy: number): number => {
  const angle = Math.atan2(dy, dx);
  return angle < 0 ? angle + Math.PI * 2 : angle;
};

export const spiralFromActiveCell = (
  windows: readonly WindowData[],
  activeCell: { readonly x: number; readonly y: number },
  grid: { readonly cellWidth: number; readonly cellHeight: number }
): WindowData[] =>
  windows.toSorted((a, b) => {
    const aCell = windowCenterCell(a, grid);
    const bCell = windowCenterCell(b, grid);
    const aDx = aCell.x - activeCell.x;
    const aDy = aCell.y - activeCell.y;
    const bDx = bCell.x - activeCell.x;
    const bDy = bCell.y - activeCell.y;
    const ringDiff =
      Math.max(Math.abs(aDx), Math.abs(aDy)) -
      Math.max(Math.abs(bDx), Math.abs(bDy));
    if (ringDiff !== 0) {
      return ringDiff;
    }
    const angleDiff = angleFromEast(aDx, aDy) - angleFromEast(bDx, bDy);
    if (angleDiff !== 0) {
      return angleDiff;
    }
    return a.id.localeCompare(b.id);
  });

import { WINDOW_BORDER, WINDOW_TITLEBAR_HEIGHT } from "../lib/constants";

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

  const defaultW = 700;
  const defaultH = 500;
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

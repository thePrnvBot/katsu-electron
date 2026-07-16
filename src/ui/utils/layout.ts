import { WINDOW_BORDER, WINDOW_TITLEBAR_HEIGHT } from "../lib/constants";

export interface Size {
  readonly h: number;
  readonly w: number;
}

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

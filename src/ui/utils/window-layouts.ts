/** Snap-layout bounds resolved against the current cell. */

import type { Bounds } from "../../shared/contract";

export type WindowLayout =
  | "left_half"
  | "right_half"
  | "left_third"
  | "center_third"
  | "right_third"
  | "top_left_quarter"
  | "top_right_quarter"
  | "bottom_left_quarter"
  | "bottom_right_quarter";

/** Human labels, shared by the layout menu and bang-command descriptions. */
export const WINDOW_LAYOUT_LABELS = {
  bottom_left_quarter: "Bottom Left Quarter",
  bottom_right_quarter: "Bottom Right Quarter",
  center_third: "Center One Third",
  left_half: "Left Half",
  left_third: "Left One Third",
  right_half: "Right Half",
  right_third: "Right One Third",
  top_left_quarter: "Top Left Quarter",
  top_right_quarter: "Top Right Quarter",
} satisfies Record<WindowLayout, string>;

/** Layout bounds as fractions of the grid cell. */
const LAYOUT_FRACTIONS = {
  bottom_left_quarter: { h: 0.5, w: 0.5, x: 0, y: 0.5 },
  bottom_right_quarter: { h: 0.5, w: 0.5, x: 0.5, y: 0.5 },
  center_third: { h: 1, w: 1 / 3, x: 1 / 3, y: 0 },
  left_half: { h: 1, w: 0.5, x: 0, y: 0 },
  left_third: { h: 1, w: 1 / 3, x: 0, y: 0 },
  right_half: { h: 1, w: 0.5, x: 0.5, y: 0 },
  right_third: { h: 1, w: 1 / 3, x: 2 / 3, y: 0 },
  top_left_quarter: { h: 0.5, w: 0.5, x: 0, y: 0 },
  top_right_quarter: { h: 0.5, w: 0.5, x: 0.5, y: 0 },
} satisfies Record<WindowLayout, { h: number; w: number; x: number; y: number }>;

export const resolveLayout = (
  layout: WindowLayout,
  grid: { cellWidth: number; cellHeight: number }
): Bounds => {
  const fractions = LAYOUT_FRACTIONS[layout];
  return {
    height: grid.cellHeight * fractions.h,
    width: grid.cellWidth * fractions.w,
    x: grid.cellWidth * fractions.x,
    y: grid.cellHeight * fractions.y,
  };
};

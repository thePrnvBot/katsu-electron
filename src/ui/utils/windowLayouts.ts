import type { Bounds } from "../store/windowStore";

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

export function resolveLayout(
  layout: WindowLayout,
  grid: { cellWidth: number; cellHeight: number }
): Bounds {
  const cvw = grid.cellWidth;
  const cvh = grid.cellHeight;

  const halfW = cvw / 2;
  const thirdW = cvw / 3;
  const quarterW = cvw / 2;
  const quarterH = cvh / 2;

  switch (layout) {
    case "left_half":
      return { x: 0, y: 0, w: halfW, h: cvh };
    case "right_half":
      return { x: halfW, y: 0, w: halfW, h: cvh };
    case "left_third":
      return { x: 0, y: 0, w: thirdW, h: cvh };
    case "center_third":
      return { x: thirdW, y: 0, w: thirdW, h: cvh };
    case "right_third":
      return { x: thirdW * 2, y: 0, w: thirdW, h: cvh };
    case "top_left_quarter":
      return { x: 0, y: 0, w: quarterW, h: quarterH };
    case "top_right_quarter":
      return { x: quarterW, y: 0, w: quarterW, h: quarterH };
    case "bottom_left_quarter":
      return { x: 0, y: quarterH, w: quarterW, h: quarterH };
    case "bottom_right_quarter":
      return { x: quarterW, y: quarterH, w: quarterW, h: quarterH };
  }
}

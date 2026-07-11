import type { Bounds } from "../store/window-store";

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

export const resolveLayout = (
  layout: WindowLayout,
  grid: { cellWidth: number; cellHeight: number }
): Bounds => {
  const cvw = grid.cellWidth;
  const cvh = grid.cellHeight;

  const halfW = cvw / 2;
  const thirdW = cvw / 3;
  const quarterW = cvw / 2;
  const quarterH = cvh / 2;

  switch (layout) {
    case "left_half": {
      return { h: cvh, w: halfW, x: 0, y: 0 };
    }
    case "right_half": {
      return { h: cvh, w: halfW, x: halfW, y: 0 };
    }
    case "left_third": {
      return { h: cvh, w: thirdW, x: 0, y: 0 };
    }
    case "center_third": {
      return { h: cvh, w: thirdW, x: thirdW, y: 0 };
    }
    case "right_third": {
      return { h: cvh, w: thirdW, x: thirdW * 2, y: 0 };
    }
    case "top_left_quarter": {
      return { h: quarterH, w: quarterW, x: 0, y: 0 };
    }
    case "top_right_quarter": {
      return { h: quarterH, w: quarterW, x: quarterW, y: 0 };
    }
    case "bottom_left_quarter": {
      return { h: quarterH, w: quarterW, x: 0, y: quarterH };
    }
    case "bottom_right_quarter": {
      return { h: quarterH, w: quarterW, x: quarterW, y: quarterH };
    }
    default: {
      throw new Error(`Unknown layout: ${layout satisfies never}`);
    }
  }
};

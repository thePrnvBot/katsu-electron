import { useCallback } from "react";

import { useCameraStore } from "../../store/camera-store";
import { useWindowStore } from "../../store/window-store";
import { centerBoundsInCell, computeWindowSize } from "../../utils/layout";

export const useMediaResize = (windowId: string) => {
  const updateWindow = useWindowStore((s) => s.updateWindow);

  return useCallback(
    (nativeWidth: number, nativeHeight: number) => {
      const { windows } = useWindowStore.getState();
      const current = windows.find((w) => w.id === windowId);
      if (!current || current.maximized) {
        return;
      }

      const { grid, currentCell } = useCameraStore.getState();
      const { w, h } = computeWindowSize(
        nativeWidth,
        nativeHeight,
        grid.cellWidth,
        grid.cellHeight
      );

      if (Math.abs(current.w - w) > 2 || Math.abs(current.h - h) > 2) {
        updateWindow(windowId, {
          h,
          w,
          ...centerBoundsInCell(w, h, grid, currentCell),
        });
      }
    },
    [updateWindow, windowId]
  );
};

/** Pans the camera to center a window's cell. */

import { useCallback } from "react";

import { useCameraStore } from "../store/camera-store";
import { useWindowStore } from "../store/window-store";
import { windowCenterCell } from "../utils/layout";

export const useCenterOnWindow = () => {
  const setActiveWindow = useWindowStore((s) => s.setActiveWindow);
  const moveToCell = useCameraStore((s) => s.moveToCell);

  return useCallback(
    (id: string) => {
      const w = useWindowStore.getState().windows[id];
      if (!w) {
        return;
      }

      const { grid } = useCameraStore.getState();
      const cell = windowCenterCell(w, grid);
      moveToCell(cell.x, cell.y);
      setActiveWindow(id);
    },
    [moveToCell, setActiveWindow]
  );
};

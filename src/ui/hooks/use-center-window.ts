import { useCallback } from "react";

import { useCameraStore } from "../store/camera-store";
import { useWindowStore } from "../store/window-store";

export const useCenterOnWindow = () => {
  const windows = useWindowStore((s) => s.windows);
  const setActiveWindow = useWindowStore((s) => s.setActiveWindow);
  const moveToCell = useCameraStore((s) => s.moveToCell);

  return useCallback(
    (id: string) => {
      const w = windows.find((x) => x.id === id);
      if (!w) {
        return;
      }

      const { grid } = useCameraStore.getState();
      const cx = Math.floor((w.x + w.w / 2) / grid.cellWidth);
      const cy = Math.floor((w.y + w.h / 2) / grid.cellHeight);

      moveToCell(cx, cy);
      setActiveWindow(id);
    },
    [windows, moveToCell, setActiveWindow]
  );
};

import { useCameraStore } from "../../store/camera-store";
import { useWindowStore } from "../../store/window-store";
import { computeWindowSize } from "../../utils/layout";

export const useMediaResize = (windowId: string) => {
  const updateWindow = useWindowStore((s) => s.updateWindow);

  return (nativeWidth: number, nativeHeight: number) => {
    const { windows } = useWindowStore.getState();
    const current = windows.find((w) => w.id === windowId);
    if (!current || current.maximized) {
      return;
    }

    const { grid } = useCameraStore.getState();
    const { w, h } = computeWindowSize(
      nativeWidth,
      nativeHeight,
      grid.cellWidth,
      grid.cellHeight
    );

    if (Math.abs(current.w - w) > 2 || Math.abs(current.h - h) > 2) {
      const cx = useCameraStore.getState().currentCell.x * grid.cellWidth;
      const cy = useCameraStore.getState().currentCell.y * grid.cellHeight;
      updateWindow(windowId, {
        h,
        w,
        x: cx + (grid.cellWidth - w) / 2,
        y: cy + (grid.cellHeight - h) / 2,
      });
    }
  };
};

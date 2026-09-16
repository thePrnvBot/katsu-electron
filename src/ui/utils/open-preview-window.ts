/** Opens generation and preview windows in the active cell. */

import { useCameraStore } from "../store/camera-store";
import { useWindowStore } from "../store/window-store";
import type { Window } from "../store/window-store";
import type { FilePreviewResult } from "./file-preview";
import { centerBoundsInCell, computeWindowSize } from "./layout";

interface CellPlacement {
  readonly h: number;
  readonly w: number;
  readonly x: number;
  readonly y: number;
}

/** New windows cascade slightly so parallel ones don't stack exactly. */
const CASCADE_STEP_PX = 28;
const CASCADE_LIMIT = 6;

const placementInCurrentCell = (): CellPlacement => {
  const { grid, currentCell } = useCameraStore.getState();
  const { w, h } = computeWindowSize(
    undefined,
    undefined,
    grid.cellWidth,
    grid.cellHeight
  );
  const { x, y } = centerBoundsInCell(w, h, grid, currentCell);
  const openCount = Object.keys(useWindowStore.getState().windows).length;
  const offset = (openCount % CASCADE_LIMIT) * CASCADE_STEP_PX;
  return { h, w, x: x + offset, y: y + offset };
};

/** Open and focus a window in the current cell with the given content. */
const openWindowInCell = (
  patch: Omit<Window, "h" | "id" | "w" | "x" | "y">
): string => {
  const windowId = crypto.randomUUID();
  const windowStore = useWindowStore.getState();
  windowStore.addWindow({
    ...placementInCurrentCell(),
    ...patch,
    id: windowId,
  });
  windowStore.setActiveWindow(windowId);
  windowStore.bringToFront(windowId);
  return windowId;
};

/** Place a preview result centered in the current cell and focus it. */
export const openPreviewWindow = (preview: FilePreviewResult): void => {
  openWindowInCell(preview);
};

/** Open a terminal window in the current cell and focus it. */
export const openTerminalWindow = (): void => {
  openWindowInCell({ fileName: "Terminal", kind: "terminal", url: "" });
};

/** Open a window that shows a generation running. It is converted into the
 * artifact preview in place when the generation finishes, so the user sees
 * the work land in the same spot it ran. */
export const openGenerationWindow = (projectName: string): string =>
  openWindowInCell({ fileName: projectName, kind: "generation", url: "" });

/** Turn a generation window into the finished artifact preview, in place. */
export const showArtifactInWindow = (
  windowId: string,
  preview: FilePreviewResult,
  projectName: string
): void => {
  useWindowStore.getState().updateWindow(windowId, {
    fileName: projectName,
    kind: undefined,
    previewType: preview.previewType,
    url: preview.url,
  });
};

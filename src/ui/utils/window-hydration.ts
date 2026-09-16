/** Staggered content hydration for restored windows. */

import { WINDOW_MOUNT_STAGGER_MS } from "../lib/constants";
import { useCameraStore } from "../store/camera-store";
import { useWindowStore } from "../store/window-store";
import { spiralFromActiveCell } from "./layout";
import { scheduleStaggered } from "./staggered";

/**
 * Mount restored windows' content outward from the active cell: every
 * window exists as a cheap chrome-only shell first, then webviews and PTYs
 * hydrate one at a time so the first paint is never stalled by a burst.
 */
export const scheduleRestoreHydration = (): void => {
  const { windows } = useWindowStore.getState();
  const suspended = Object.values(windows).filter((w) => !(w.live ?? true));
  if (suspended.length === 0) {
    return;
  }

  const { grid, currentCell } = useCameraStore.getState();
  const ordered = spiralFromActiveCell(suspended, currentCell, grid);
  scheduleStaggered(ordered, (entry) => {
    useWindowStore.getState().hydrateWindow(entry.id);
  }, WINDOW_MOUNT_STAGGER_MS);
};

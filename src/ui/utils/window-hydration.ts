/** Staggered content hydration for restored windows. */

import { WINDOW_MOUNT_STAGGER_MS } from "../lib/constants";
import { useCameraStore } from "../store/camera-store";
import { useWindowStore } from "../store/window-store";
import { spiralFromActiveCell } from "./layout";

/** Timers of an in-flight hydration pass so a new pass can cancel them. */
const pendingHydrationTimers: number[] = [];

const cancelPendingHydration = (): void => {
  for (const timer of pendingHydrationTimers.splice(0)) {
    window.clearTimeout(timer);
  }
};

/**
 * Mount restored windows' content outward from the active cell: every
 * window exists as a cheap chrome-only shell first, then webviews and PTYs
 * hydrate one at a time so the first paint is never stalled by a burst.
 */
export const scheduleRestoreHydration = (): void => {
  cancelPendingHydration();
  const { windows } = useWindowStore.getState();
  const suspended = Object.values(windows).filter((w) => !(w.live ?? true));
  if (suspended.length === 0) {
    return;
  }

  const { grid, currentCell } = useCameraStore.getState();
  const ordered = spiralFromActiveCell(suspended, currentCell, grid);
  for (const [index, entry] of ordered.entries()) {
    pendingHydrationTimers.push(
      window.setTimeout(() => {
        useWindowStore.getState().hydrateWindow(entry.id);
      }, index * WINDOW_MOUNT_STAGGER_MS)
    );
  }
};

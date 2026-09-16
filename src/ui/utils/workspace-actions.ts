/** Workspace save, load, and delete actions over IPC. */

import { WINDOW_MOUNT_STAGGER_MS } from "../lib/constants";
import { useCameraStore } from "../store/camera-store";
import { useWindowStore } from "../store/window-store";
import { spiralFromActiveCell, windowCenterCell } from "./layout";
import { scheduleStaggered } from "./staggered";
import {
  isPersistableWindow,
  windowFromMetadata,
  windowMetadataFromWindow,
} from "./window-metadata";

/**
 * Workspace actions for the command menu: the renderer owns the live window
 * state, the main process owns the `workspaces.json` file. Errors are
 * returned as user-facing strings; null means success.
 */

export const saveCurrentWorkspace = async (
  name: string
): Promise<string | null> => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "Type a name for the workspace first.";
  }
  const metadata = Object.values(useWindowStore.getState().windows)
    .filter(isPersistableWindow)
    .map(windowMetadataFromWindow);
  try {
    await window.electronAPI.saveWorkspace(trimmed, metadata);
    return null;
  } catch {
    return "Could not save the workspace.";
  }
};

export const loadWorkspaceByName = async (
  name: string
): Promise<string | null> => {
  try {
    const savedWindows = await window.electronAPI.loadWorkspace(name);
    if (!savedWindows) {
      return `Workspace "${name}" was not found.`;
    }
    const windows = savedWindows
      .filter(isPersistableWindow)
      .map(windowFromMetadata);
    const { grid, currentCell } = useCameraStore.getState();
    const ordered = spiralFromActiveCell(windows, currentCell, grid);

    // Mounting every webview/terminal at once stalls the renderer — stagger
    // the mounts outward from the active cell so the app stays responsive.
    useWindowStore.getState().replaceWindows([]);
    scheduleStaggered(ordered, (entry) => {
      useWindowStore.getState().addWindow(entry);
    }, WINDOW_MOUNT_STAGGER_MS);

    const [first] = ordered;
    if (first) {
      const cell = windowCenterCell(first, grid);
      useCameraStore.getState().moveToCell(cell.x, cell.y);
    }
    return null;
  } catch {
    return "Could not load the workspace.";
  }
};

export const deleteWorkspaceByName = async (
  name: string
): Promise<string | null> => {
  try {
    await window.electronAPI.deleteWorkspace(name);
    return null;
  } catch {
    return "Could not delete the workspace.";
  }
};

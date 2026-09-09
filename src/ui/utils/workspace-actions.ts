import { useCameraStore } from "../store/camera-store";
import { useWindowStore } from "../store/window-store";
import { windowCenterCell } from "./layout";
import {
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
  // Preview windows reference temp files wiped between runs — exclude them.
  const metadata = useWindowStore
    .getState()
    .windows.filter((w) => w.previewType === undefined)
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
      .filter((w) => w.previewType === undefined)
      .map(windowFromMetadata);
    useWindowStore.getState().replaceWindows(windows);

    const [first] = windows;
    if (first) {
      const { grid } = useCameraStore.getState();
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

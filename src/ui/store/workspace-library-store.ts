/** Cached menu view of the saved workspace library. */

import { create } from "zustand";

import type { WorkspaceSummary } from "../../shared/contract";

interface WorkspaceLibraryState {
  workspaces: readonly WorkspaceSummary[];
  refresh: () => Promise<void>;
}

/**
 * Cached view of the main-process workspace library. `refresh` re-reads the
 * library over IPC; failures leave the previous cached list untouched.
 */
export const useWorkspaceLibrary = create<WorkspaceLibraryState>((set) => ({
  refresh: async () => {
    try {
      set({ workspaces: await window.electronAPI.listWorkspaces() });
    } catch {
      set({ workspaces: [] });
    }
  },
  workspaces: [],
}));

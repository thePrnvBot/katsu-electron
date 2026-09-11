/** Queue of permission requests awaiting the dialog. */

import { create } from "zustand";

import type { PermissionRequestPayload } from "../../shared/contract";

/**
 * Requests queue instead of overwriting: each one gets its own dialog
 * turn and its own answer, even when several sites ask at once.
 */
interface PermissionState {
  requests: readonly PermissionRequestPayload[];
  pushRequest: (request: PermissionRequestPayload) => void;
  removeRequest: (id: string) => void;
}

export const usePermissionStore = create<PermissionState>((set) => ({
  pushRequest: (request) =>
    set((s) => ({ requests: [...s.requests, request] })),

  removeRequest: (id) =>
    set((s) => ({
      requests: s.requests.filter((request) => request.id !== id),
    })),

  requests: [],
}));

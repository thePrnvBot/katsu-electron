import { create } from "zustand";

import type { PermissionRequestPayload } from "../../shared/contract";

interface PermissionState {
  request: PermissionRequestPayload | null;
  setRequest: (request: PermissionRequestPayload | null) => void;
}

export const usePermissionStore = create<PermissionState>((set) => ({
  request: null,
  setRequest: (request) => set({ request }),
}));

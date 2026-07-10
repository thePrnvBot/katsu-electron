import { useEffect, useRef } from "react";

interface PermissionRequest {
  id: string;
  permission: string;
  origin: string;
  message: string;
}

export function usePermissions() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const cleanup = window.electronAPI.onPermissionRequest((request: PermissionRequest) => {
      const granted = window.confirm(
        `${request.origin} wants to access ${request.permission}.\n\n${request.message}`
      );
      window.electronAPI.respondToPermission(request.id, granted);
    });

    return cleanup;
  }, []);
}

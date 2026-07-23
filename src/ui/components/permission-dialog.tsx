import { useEffect, useRef } from "react";

import { Z_PERMISSION_DIALOG } from "../lib/constants";
import { usePermissionStore } from "../store/permission-store";

/**
 * Modal permission dialog with focus trap, Escape-to-deny, and
 * `data-permission-dialog` so the global keydown handler can detect it
 * without subscribing to the store.
 */
export const PermissionDialog = () => {
  const request = usePermissionStore((s) => s.request);
  const setRequest = usePermissionStore((s) => s.setRequest);
  const allowRef = useRef<HTMLButtonElement>(null);
  const denyRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    window.electronAPI.setPermissionRequestHandler((permissionRequestPayload) => {
      setRequest(permissionRequestPayload);
    });
  }, [setRequest]);

  useEffect(() => {
    if (request) {
      dialogRef.current?.showModal();
      // Auto-focus the deny button (safe default).
      denyRef.current?.focus();
    } else {
      dialogRef.current?.close();
    }
  }, [request]);

  if (!request) {
    return null;
  }

  const respond = (granted: boolean) => {
    void window.electronAPI.respondToPermission(request.id, granted);
    setRequest(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      respond(false);
      return;
    }
    // Minimal focus trap: Tab cycles between the two buttons.
    if (e.key === "Tab") {
      const active = document.activeElement;
      if (e.shiftKey && active === denyRef.current) {
        e.preventDefault();
        allowRef.current?.focus();
      } else if (!e.shiftKey && active === allowRef.current) {
        e.preventDefault();
        denyRef.current?.focus();
      }
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      style={{ zIndex: Z_PERMISSION_DIALOG }}
      data-permission-dialog
      aria-labelledby="permission-dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div className="w-96 rounded-2xl border border-white/10 bg-[#222] p-5 shadow-lg backdrop-blur-sm">
        <h3
          id="permission-dialog-title"
          className="text-base font-medium text-white/70"
        >
          Permission Request
        </h3>
        <p className="mt-2 text-sm text-[#eee]">
          {request.origin} wants to access {request.permission}.
        </p>
        {request.message && (
          <p className="mt-1 text-sm text-[#eee]">{request.message}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={denyRef}
            type="button"
            onClick={() => respond(false)}
            className="rounded-full bg-[#444] px-4 py-1.5 text-sm text-white/70 transition hover:bg-[#555]"
          >
            Deny
          </button>
          <button
            ref={allowRef}
            type="button"
            onClick={() => respond(true)}
            className="rounded-full bg-[#444] px-4 py-1.5 text-sm text-white/70 transition hover:bg-[#555]"
          >
            Allow
          </button>
        </div>
      </div>
    </dialog>
  );
};

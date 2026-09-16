/** Modal dialog approving or denying camera and microphone requests. */

import { ShieldAlert } from "lucide-react";
import { useEffect, useRef } from "react";

import { Z_PERMISSION_DIALOG } from "../lib/constants";
import { usePermissionStore } from "../store/permission-store";

/**
 * Modal permission dialog with focus trap and Escape-to-deny. The app's
 * global keydown handler suppresses camera shortcuts while requests queue.
 */
export const PermissionDialog = () => {
  // Show the head of the queue; answering it reveals the next request.
  const requests = usePermissionStore((s) => s.requests);
  const removeRequest = usePermissionStore((s) => s.removeRequest);
  const request = requests[0] ?? null;
  const allowRef = useRef<HTMLButtonElement>(null);
  const denyRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    window.electronAPI.setPermissionRequestHandler(
      (permissionRequestPayload) => {
        usePermissionStore.getState().pushRequest(permissionRequestPayload);
      }
    );
    window.electronAPI.setPermissionCancelledHandler((requestId) => {
      usePermissionStore.getState().removeRequest(requestId);
    });
  }, []);

  useEffect(() => {
    if (request) {
      if (!dialogRef.current?.open) {
        dialogRef.current?.showModal();
      }
      // Auto-focus the deny button (safe default).
      denyRef.current?.focus();
    } else {
      dialogRef.current?.close();
    }
  }, [request]);

  if (!request) {
    return null;
  }

  const respond = async (granted: boolean): Promise<void> => {
    if (!request) {
      return;
    }
    removeRequest(request.id);
    try {
      await window.electronAPI.respondToPermission(request.id, granted);
    } catch {
      // The main process may already be quitting.
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      void respond(false);
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
      className="font-[Geist,system-ui,sans-serif] fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      style={{ zIndex: Z_PERMISSION_DIALOG }}
      data-permission-dialog
      aria-labelledby="permission-dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div className="w-96 rounded-2xl border border-white/10 bg-[#1e1e1e] p-5 shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
            <ShieldAlert size={18} />
          </span>
          <div className="min-w-0">
            <h3
              id="permission-dialog-title"
              className="text-sm font-medium text-white/90"
            >
              Permission Request
            </h3>
            <p className="text-xs text-white/40">A site is requesting access</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-white/80">
          <span className="text-white/50">{request.origin}</span> wants to
          access{" "}
          <span className="font-medium text-white">{request.permission}</span>.
        </p>
        {request.message && (
          <p className="mt-1 text-sm text-white/50">{request.message}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={denyRef}
            type="button"
            onClick={() => {
              void respond(false);
            }}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-sm text-white/70 transition hover:border-white/20 hover:bg-white/10"
          >
            Deny
          </button>
          <button
            ref={allowRef}
            type="button"
            onClick={() => {
              void respond(true);
            }}
            className="rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-black transition hover:bg-white/90"
          >
            Allow
          </button>
        </div>
      </div>
    </dialog>
  );
};

/**
 * Shared IPC contract: types and zero-dependency runtime parsers.
 *
 * This module is imported by BOTH the Electron main process and the
 * renderer, so it must stay free of Node/Electron/effect dependencies.
 * The main process re-declares these shapes as effect Schemas in
 * `src/electron/schemas/ipc-schemas.ts` with compile-time conformance
 * annotations — keep the two in sync.
 */

export type PreviewType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "download";

export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WindowMetadata {
  readonly id: string;
  readonly url: string;
  readonly bounds: Bounds;
  readonly zIndex: number;
  readonly title?: string;
  readonly previewType?: PreviewType;
}

export interface Settings {
  readonly keepWindowsAlive: boolean;
  readonly windowPeeking: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  keepWindowsAlive: false,
  windowPeeking: false,
};

export interface PermissionRequestPayload {
  readonly id: string;
  readonly permission: string;
  readonly origin: string;
  readonly message: string;
}

export interface BlockedCountPayload {
  readonly count: number;
  readonly origin: string;
}

// --- Command envelope (renderer -> main via IpcChannel.command) ---

export type WindowControlAction = "minimize" | "maximize" | "close";

export interface WindowControlCommand {
  readonly type: "window:control";
  readonly payload: WindowControlAction;
}

export interface SettingsSaveCommand {
  readonly type: "settings:save";
  readonly payload: { readonly settings: Settings };
}

export interface PermissionRespondCommand {
  readonly type: "permission:respond";
  readonly payload: { readonly requestId: string; readonly granted: boolean };
}

export type IPCCommand =
  | WindowControlCommand
  | SettingsSaveCommand
  | PermissionRespondCommand;

export type IPCResult =
  | { readonly success: true; readonly data: unknown }
  | { readonly success: false; readonly error: string };

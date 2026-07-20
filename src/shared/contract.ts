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

// --- Boundary parsers (unknown -> typed, or fallback) ---

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPreviewType = (value: unknown): value is PreviewType =>
  typeof value === "string" &&
  ["text", "image", "video", "audio", "pdf", "download"].includes(value);

const parseBounds = (value: unknown): Bounds | null => {
  if (!isRecord(value)) {
    return null;
  }
  const { x, y, width, height } = value;
  if (
    typeof x === "number" &&
    typeof y === "number" &&
    typeof width === "number" &&
    typeof height === "number"
  ) {
    return { height, width, x, y };
  }
  return null;
};

const parseWindowMetadata = (value: unknown): WindowMetadata | null => {
  if (!isRecord(value)) {
    return null;
  }
  const { id, url, zIndex, title, previewType } = value;
  const bounds = parseBounds(value.bounds);
  if (typeof id !== "string" || typeof url !== "string" || !bounds) {
    return null;
  }
  return {
    bounds,
    id,
    previewType: isPreviewType(previewType) ? previewType : undefined,
    title: typeof title === "string" ? title : undefined,
    url,
    zIndex: typeof zIndex === "number" ? zIndex : 1,
  };
};

/** Drops malformed entries instead of rejecting the whole restore. */
export const parseWindowMetadataArray = (value: unknown): WindowMetadata[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const windows: WindowMetadata[] = [];
  for (const entry of value) {
    const parsed = parseWindowMetadata(entry);
    if (parsed) {
      windows.push(parsed);
    }
  }
  return windows;
};

export const parseSettings = (value: unknown): Settings => {
  if (isRecord(value)) {
    return {
      keepWindowsAlive:
        typeof value.keepWindowsAlive === "boolean"
          ? value.keepWindowsAlive
          : DEFAULT_SETTINGS.keepWindowsAlive,
      windowPeeking:
        typeof value.windowPeeking === "boolean"
          ? value.windowPeeking
          : DEFAULT_SETTINGS.windowPeeking,
    };
  }
  return DEFAULT_SETTINGS;
};

export const parsePermissionRequestPayload = (
  value: unknown
): PermissionRequestPayload | null => {
  if (!isRecord(value)) {
    return null;
  }
  const { id, permission, origin, message } = value;
  if (
    typeof id === "string" &&
    typeof permission === "string" &&
    typeof origin === "string" &&
    typeof message === "string"
  ) {
    return { id, message, origin, permission };
  }
  return null;
};

export { ProtocolError } from "./errors/protocol-error.js";
export { IPCError } from "./errors/ipc-error.js";

interface Bounds {
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
}

type PermissionType =
  | "geolocation"
  | "notifications"
  | "camera"
  | "microphone"
  | "clipboard-read"
  | "clipboard-write";

export interface PermissionRequest {
  readonly id: string;
  readonly windowId: string;
  readonly permission: PermissionType;
  readonly origin: string;
  readonly message: string;
}

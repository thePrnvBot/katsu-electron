export { ProtocolError } from "./errors/protocol-error.js";
export { PersistenceError } from "./errors/persistence-error.js";
export { IPCError } from "./errors/ipc-error.js";

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
}

export interface WindowState extends WindowMetadata {
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly errorMessage?: string;
}

export type NavigationAction = "back" | "forward" | "reload";

export type PermissionType =
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

export type WindowEvent =
  | { readonly _tag: "WindowCreated"; readonly window: WindowState }
  | { readonly _tag: "WindowClosed"; readonly windowId: string }
  | { readonly _tag: "WindowFocused"; readonly windowId: string }
  | {
      readonly _tag: "WindowTitleChanged";
      readonly windowId: string;
      readonly title: string;
    }
  | {
      readonly _tag: "WindowLoadFailed";
      readonly windowId: string;
      readonly error: string;
    };

export type IPCEvent =
  | { readonly _tag: "WindowEvent"; readonly event: WindowEvent }
  | { readonly _tag: "PermissionRequest"; readonly request: PermissionRequest };

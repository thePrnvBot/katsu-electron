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
  | "markdown"
  | "download"
  | "html";

/**
 * Lowercase file extensions (no dot) and their preview/MIME tables live in
 * `file-types.ts` — the single source shared by main's artifact staging and
 * the renderer's preview classification.
 */

export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type WindowKind = "webview" | "terminal" | "generation";

export interface WindowMetadata {
  readonly id: string;
  readonly url: string;
  readonly bounds: Bounds;
  readonly zIndex: number;
  readonly title?: string;
  readonly previewType?: PreviewType;
  /** Defaults to "webview" when absent — keeps old persisted state valid. */
  readonly kind?: WindowKind;
}

export const ARTIFACT_PROVIDER_IDS = ["opencode", "claude", "codex"] as const;

export type ArtifactProviderId = (typeof ARTIFACT_PROVIDER_IDS)[number];

/** A local agent CLI that can generate artifacts on this machine. */
export interface ArtifactProviderSummary {
  readonly id: ArtifactProviderId;
  readonly label: string;
  /** Whether the provider's executable was found on PATH. */
  readonly available: boolean;
}

interface ArtifactStartResult {
  readonly generationId: string;
}

/** Outcome of starting a generation — failures carry user-facing text. */
export type ArtifactStartResponse =
  | { readonly success: true; readonly data: ArtifactStartResult }
  | { readonly success: false; readonly error: string };

/** Outcome of cancelling a generation — failures carry user-facing text. */
export type ArtifactCancelResponse =
  | { readonly success: true }
  | { readonly success: false; readonly error: string };

/** Maximum length of a generation prompt accepted at the IPC boundary. */
export const MAX_ARTIFACT_PROMPT_LENGTH = 4000;

/** A generated file, already copied into the served drops directory. */
export interface ArtifactResultPayload {
  readonly fileName: string;
  readonly path: string;
  /** Title the agent gave the artifact (HTML `<title>`), when present. */
  readonly title?: string;
}

/** Terminal outcome of one generation; progress events are not forwarded. */
export type ArtifactProgressEvent =
  | { readonly type: "done"; readonly result: ArtifactResultPayload }
  | { readonly type: "error"; readonly message: string };

export interface ArtifactProgressPayload {
  readonly generationId: string;
  readonly event: ArtifactProgressEvent;
}

export interface Settings {
  readonly keepWindowsAlive: boolean;
  readonly windowPeeking: boolean;
  readonly artifactProviderId: ArtifactProviderId;
}

export const DEFAULT_SETTINGS: Settings = {
  artifactProviderId: "opencode",
  keepWindowsAlive: false,
  windowPeeking: false,
};

/** Summary of a saved workspace for list UIs. */
export interface WorkspaceSummary {
  readonly name: string;
  readonly windowCount: number;
}

/** Maximum size for files copied into the preview staging directory. */
export const MAX_TEMP_FILE_BYTES = 256 * 1024 * 1024;

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

// --- Terminal (PTY) IPC payloads ---

export interface TerminalSpawnOptions {
  readonly cols: number;
  readonly rows: number;
  readonly cwd?: string;
}

export interface TerminalSpawnResult {
  readonly id: string;
}

export interface TerminalWritePayload {
  readonly id: string;
  readonly data: string;
}

export interface TerminalResizePayload {
  readonly id: string;
  readonly cols: number;
  readonly rows: number;
}

export interface TerminalDataPayload {
  readonly id: string;
  readonly data: string;
}

export interface TerminalExitPayload {
  readonly id: string;
  readonly exitCode: number;
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

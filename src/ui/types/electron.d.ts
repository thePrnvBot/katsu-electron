/** Typed shape of the preload-exposed electronAPI bridge. */

// Electron's global namespace (WebviewTag, event types) for renderer code.
/// <reference types="electron" />

import type {
  ArtifactCancelResponse,
  ArtifactProgressEvent,
  ArtifactProviderId,
  ArtifactProviderSummary,
  ArtifactStartResponse,
  BlockedCountPayload,
  IPCCommand,
  IPCResult,
  PermissionRequestPayload,
  Settings,
  TerminalDataPayload,
  TerminalExitPayload,
  TerminalSpawnOptions,
  TerminalSpawnResult,
  WindowMetadata,
  WorkspaceSummary,
} from "../../shared/contract";

export interface ElectronAPI {
  /** Cancel a running artifact generation (its workspace is removed). */
  cancelArtifact: (generationId: string) => Promise<ArtifactCancelResponse>;
  /** Delete a temp preview file inside the drops dir. */
  deleteTempFile: (filePath: string) => Promise<void>;
  /** Start a local sandboxed artifact generation. */
  generateArtifact: (
    prompt: string,
    providerId: ArtifactProviderId
  ) => Promise<ArtifactStartResponse>;
  /** List local agent providers and whether they are installed. */
  listArtifactProviders: () => Promise<ArtifactProviderSummary[]>;
  /** Native open dialog; grants stage capability for the picked paths. */
  openFile: () => Promise<{
    canceled: boolean;
    filePaths: string[];
  }>;
  respondToPermission: (
    requestId: string,
    granted: boolean
  ) => Promise<IPCResult>;
  saveSettings: (settings: Settings) => Promise<IPCResult>;
  saveStateResponse: (windows: WindowMetadata[]) => Promise<void>;
  saveTempFile: (name: string, buffer: ArrayBuffer) => Promise<string>;
  /** Save current windows under a workspace name (overwrites same name). */
  saveWorkspace: (name: string, windows: WindowMetadata[]) => Promise<void>;
  /** List saved workspace summaries, sorted by name. */
  listWorkspaces: () => Promise<WorkspaceSummary[]>;
  /** Load a saved workspace's windows (null when the name is unknown). */
  loadWorkspace: (name: string) => Promise<readonly WindowMetadata[] | null>;
  /** Delete a saved workspace by name (no-op when the name is unknown). */
  deleteWorkspace: (name: string) => Promise<void>;
  sendCommand: (command: IPCCommand) => Promise<IPCResult>;
  /** Subscribe to progress for one generation. Returns an unsubscribe fn. */
  setArtifactProgressHandler: (
    generationId: string,
    handler: (event: ArtifactProgressEvent) => void
  ) => () => void;
  /**
   * Subscribe to blocked-ad counts for one origin (pre-filtered in preload).
   * Returns an unsubscribe fn.
   */
  setBlockedCountHandler: (
    origin: string,
    handler: (data: BlockedCountPayload) => void
  ) => () => void;
  setPermissionCancelledHandler: (handler: (requestId: string) => void) => void;
  setPermissionRequestHandler: (
    handler: (request: PermissionRequestPayload) => void
  ) => void;
  setRequestSaveHandler: (handler: () => void) => void;
  setSettingsLoadedHandler: (handler: (settings: Settings) => void) => void;
  setStateLoadedHandler: (handler: (windows: WindowMetadata[]) => void) => void;
  /** Copy a dialog-granted file into the drops dir (no buffer round-trip). */
  stageFile: (filePath: string) => Promise<{ name: string; path: string }>;
  /** Kill a PTY session (on window close/unmount). */
  terminalKill: (id: string) => Promise<void>;
  /** Resize a PTY session to match the fit-addon's computed cols/rows. */
  terminalResize: (id: string, cols: number, rows: number) => Promise<void>;
  /** Spawn a new PTY session, returns its id. */
  terminalSpawn: (
    options: TerminalSpawnOptions
  ) => Promise<TerminalSpawnResult>;
  /** Write renderer input (keystrokes, paste) into a PTY session. */
  terminalWrite: (id: string, data: string) => Promise<void>;
  /** Subscribe to output for a given terminal id. Returns an unsubscribe fn. */
  setTerminalDataHandler: (
    id: string,
    handler: (data: TerminalDataPayload) => void
  ) => () => void;
  /** Subscribe to exit for a given terminal id. Returns an unsubscribe fn. */
  setTerminalExitHandler: (
    id: string,
    handler: (data: TerminalExitPayload) => void
  ) => () => void;
  clearTerminalEventBuffer: (id: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

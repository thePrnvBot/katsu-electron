import type {
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
} from "../../shared/contract";

export interface ElectronAPI {
  /** Delete a temp preview file inside the drops dir. */
  deleteTempFile: (filePath: string) => Promise<void>;
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
  sendCommand: (command: IPCCommand) => Promise<IPCResult>;
  setBlockedCountHandler: (
    subscriberId: string,
    handler: (data: BlockedCountPayload) => void
  ) => () => void;
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

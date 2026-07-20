import type {
  BlockedCountPayload,
  IPCCommand,
  IPCResult,
  PermissionRequestPayload,
  Settings,
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

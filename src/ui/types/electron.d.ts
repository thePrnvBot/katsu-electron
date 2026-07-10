interface ElectronAPI {
  sendCommand: (command: unknown) => Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }>;
  openFile: () => Promise<{
    canceled: boolean;
    filePaths: string[];
  }>;
  onStateLoaded: (callback: (windows: unknown[]) => void) => () => void;
  onEvent: (callback: (event: unknown) => void) => () => void;
  platform: string;
  getWebviewPreloadPath: () => string;
  onBlockedCount: (callback: (count: number) => void) => () => void;
  onPermissionRequest: (
    callback: (request: {
      id: string;
      permission: string;
      origin: string;
      message: string;
    }) => void
  ) => () => void;
  respondToPermission: (permissionId: string, granted: boolean) => Promise<unknown>;
  saveState: (windows: unknown[]) => Promise<unknown>;
  onRequestSave: (callback: () => void) => () => void;
  saveStateResponse: (windows: unknown[]) => Promise<unknown>;
  saveTempFile: (name: string, buffer: ArrayBuffer) => Promise<string>;
}

interface Window {
  electronAPI: ElectronAPI;
}

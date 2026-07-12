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
  setStateLoadedHandler: (handler: (windows: unknown[]) => void) => void;
  setSettingsLoadedHandler: (handler: (settings: unknown) => void) => void;
  setEventHandler: (handler: (event: unknown) => void) => void;
  platform: string;
  getWebviewPreloadPath: () => string;
  getUserAgent: () => string;
  setBlockedCountHandler: (
    subscriberId: string,
    handler: (data: { count: number; origin: string }) => void
  ) => () => void;
  setPermissionRequestHandler: (
    handler: (request: {
      id: string;
      permission: string;
      origin: string;
      message: string;
    }) => void
  ) => void;
  respondToPermission: (
    permissionId: string,
    granted: boolean
  ) => Promise<unknown>;
  saveState: (windows: unknown[]) => Promise<unknown>;
  saveSettings: (settings: unknown) => Promise<unknown>;
  loadSettings: () => Promise<unknown>;
  setRequestSaveHandler: (handler: () => void) => void;
  saveStateResponse: (windows: unknown[]) => Promise<unknown>;
  saveTempFile: (name: string, buffer: ArrayBuffer) => Promise<string>;
}

interface Window {
  electronAPI: ElectronAPI;
}

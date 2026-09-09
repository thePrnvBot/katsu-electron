/**
 * IPC channel names shared between main, preload and renderer.
 * Single source of truth — never inline channel strings.
 */
export const IpcChannel = {
  /** Main -> renderer push events. */
  adblockCount: "adblock:count",
  /** Renderer -> main unified command envelope (see contract.ts `IPCCommand`). */
  command: "katsu:command",
  dialogOpenFile: "dialog:openFile",
  dialogSaveTempFile: "dialog:saveTempFile",
  fsDeleteTempFile: "fs:deleteTempFile",
  fsStageFile: "fs:stageFile",
  permissionRequest: "permission:request",
  settingsLoaded: "settings:loaded",
  stateLoaded: "state:loaded",
  stateRequestSave: "state:requestSave",
  stateSaveResponse: "state:saveResponse",
  /** Main -> renderer push: PTY output for a given terminal id. */
  terminalData: "terminal:data",
  /** Main -> renderer push: PTY process exited. */
  terminalExit: "terminal:exit",
  terminalKill: "terminal:kill",
  terminalResize: "terminal:resize",
  terminalSpawn: "terminal:spawn",
  terminalWrite: "terminal:write",
  /** Renderer -> main: workspace persistence (save/list/load/delete). */
  workspaceDelete: "workspace:delete",
  workspaceList: "workspace:list",
  workspaceLoad: "workspace:load",
  workspaceSave: "workspace:save",
} as const;

export type IpcChannel = (typeof IpcChannel)[keyof typeof IpcChannel];

/**
 * IPC channel names shared between main and renderer.
 * Single source of truth — never inline channel strings. The one sanctioned
 * exception is the sandboxed preload, which cannot require local modules;
 * its inlined copy is drift-guarded by `src/electron/preload-sync.test.ts`.
 */
export const IpcChannel = {
  /** Main -> renderer push events. */
  adblockCount: "adblock:count",
  /** Renderer -> main: cancel a running artifact generation. */
  artifactCancel: "artifact:cancel",
  /** Renderer -> main: start a sandboxed artifact generation. */
  artifactGenerate: "artifact:generate",
  /** Main -> renderer push: generation progress/output/result. */
  artifactProgress: "artifact:progress",
  /** Renderer -> main: list local agent providers and availability. */
  artifactProviders: "artifact:providers",
  /** Renderer -> main unified command envelope (see contract.ts `IPCCommand`). */
  command: "katsu:command",
  dialogOpenFile: "dialog:openFile",
  dialogSaveTempFile: "dialog:saveTempFile",
  fsDeleteTempFile: "fs:deleteTempFile",
  fsStageFile: "fs:stageFile",
  /** Main -> renderer push: a pending permission request was cancelled. */
  permissionCancelled: "permission:cancelled",
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

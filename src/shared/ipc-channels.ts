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
} as const;

export type IpcChannel = (typeof IpcChannel)[keyof typeof IpcChannel];

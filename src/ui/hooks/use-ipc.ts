const sendCommand = (command: unknown) =>
  window.electronAPI.sendCommand(command);

const openFile = () => window.electronAPI.openFile();

export const useIPC = () => ({ openFile, sendCommand });

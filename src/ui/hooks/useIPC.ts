export function useIPC() {
  const sendCommand = async (command: unknown) => {
    return window.electronAPI.sendCommand(command);
  };

  const openFile = async () => {
    return window.electronAPI.openFile();
  };

  return { sendCommand, openFile };
}

const handleClose = () =>
  window.electronAPI.sendCommand({
    payload: "close",
    type: "window:control",
  });
const handleMinimize = () =>
  window.electronAPI.sendCommand({
    payload: "minimize",
    type: "window:control",
  });
const handleMaximize = () =>
  window.electronAPI.sendCommand({
    payload: "maximize",
    type: "window:control",
  });

export const TitleBar = () => (
  <div className="app-region-drag fixed top-0 left-0 right-0 z-50 flex h-8 items-center bg-[#1a1a1a]">
    <div className="app-region-no-drag ml-3 flex gap-2">
      <button
        type="button"
        onClick={handleClose}
        className="h-3 w-3 rounded-full bg-[#ff5f57] transition-colors hover:bg-[#ff4040]"
        aria-label="Close"
      />
      <button
        type="button"
        onClick={handleMinimize}
        className="h-3 w-3 rounded-full bg-[#febc2e] transition-colors hover:bg-[#ffa500]"
        aria-label="Minimize"
      />
      <button
        type="button"
        onClick={handleMaximize}
        className="h-3 w-3 rounded-full bg-[#28c840] transition-colors hover:bg-[#20a834]"
        aria-label="Maximize"
      />
    </div>
  </div>
);

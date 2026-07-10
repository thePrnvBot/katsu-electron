export function TitleBar() {
  const handleClose = () =>
    window.electronAPI.sendCommand({ type: "window:control", payload: "close" });
  const handleMinimize = () =>
    window.electronAPI.sendCommand({
      type: "window:control",
      payload: "minimize",
    });
  const handleMaximize = () =>
    window.electronAPI.sendCommand({
      type: "window:control",
      payload: "maximize",
    });

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex h-8 items-center bg-[#1a1a1a]"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div
        className="ml-3 flex gap-2"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          onClick={handleClose}
          className="h-3 w-3 rounded-full bg-[#ff5f57] transition-colors hover:bg-[#ff4040]"
          aria-label="Close"
        />
        <button
          onClick={handleMinimize}
          className="h-3 w-3 rounded-full bg-[#febc2e] transition-colors hover:bg-[#ffa500]"
          aria-label="Minimize"
        />
        <button
          onClick={handleMaximize}
          className="h-3 w-3 rounded-full bg-[#28c840] transition-colors hover:bg-[#20a834]"
          aria-label="Maximize"
        />
      </div>
    </div>
  );
}

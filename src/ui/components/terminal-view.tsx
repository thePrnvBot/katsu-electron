import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";

import "@xterm/xterm/css/xterm.css";

const TERMINAL_THEME = {
  background: "#0f0f0f",
  cursor: "#ddd",
  foreground: "#ddd",
};

interface TerminalViewProps {
  windowId: string;
  /** Working directory for the spawned shell. Defaults to the user's home. */
  cwd?: string;
}

/**
 * Owns one PTY session for the lifetime of the mounted window: spawns on
 * mount, streams data both ways over IPC, resizes with the container, and
 * kills the session on unmount so shells never orphan.
 */
export const TerminalView = ({ windowId, cwd }: TerminalViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const exitedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    exitedRef.current = false;
    const term = new Terminal({
      // Draw block/box drawing chars as pixel-perfect shapes instead of font
      // glyphs so ASCII art renders flush. Ignored by the DOM renderer.
      cursorBlink: true,
      customGlyphs: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: 13,
      theme: TERMINAL_THEME,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    // The DOM renderer (xterm 6 default) can't draw custom glyphs, so block and
    // box drawing characters come from the font and leave seams. The WebGL
    // renderer draws them as exact cell-filling shapes.
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // WebGL2 unavailable (e.g. GPU acceleration disabled) — fall back to the
      // DOM renderer, which stays functional, just without custom glyphs.
    }
    fitAddon.fit();

    let terminalId: string | null = null;
    let disposed = false;
    let unsubData: (() => void) | null = null;
    let unsubExit: (() => void) | null = null;

    const showExitBanner = (exitCode: number) => {
      if (exitedRef.current) {
        return;
      }
      exitedRef.current = true;
      term.write(
        `\r\n\u001B[90m[process exited with code ${exitCode}]\u001B[0m`
      );
    };

    const spawnSession = async () => {
      try {
        const { id } = await window.electronAPI.terminalSpawn({
          cols: term.cols,
          cwd,
          rows: term.rows,
        });
        if (disposed) {
          // Component unmounted while the spawn was in flight.
          void window.electronAPI.terminalKill(id);
          return;
        }
        terminalId = id;
        unsubData = window.electronAPI.setTerminalDataHandler(id, (payload) => {
          term.write(payload.data);
        });
        unsubExit = window.electronAPI.setTerminalExitHandler(id, (payload) => {
          showExitBanner(payload.exitCode);
        });
      } catch {
        term.write("\r\n\u001B[91mFailed to start terminal\u001B[0m");
      }
    };
    void spawnSession();

    const dataDisposable = term.onData((data) => {
      if (terminalId) {
        void window.electronAPI.terminalWrite(terminalId, data);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (terminalId) {
        void window.electronAPI.terminalResize(
          terminalId,
          term.cols,
          term.rows
        );
      }
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      dataDisposable.dispose();
      unsubData?.();
      unsubExit?.();
      if (terminalId) {
        void window.electronAPI.terminalKill(terminalId);
      }
      term.dispose();
    };
    // windowId/cwd are fixed for the lifetime of a window — re-running this
    // effect would kill and respawn the shell, losing the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      data-window-id={windowId}
      style={{
        height: "100%",
        padding: 6,
        width: "100%",
      }}
    />
  );
};

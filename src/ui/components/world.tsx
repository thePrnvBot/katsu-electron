import { useEffect, useRef } from "react";

import { useFileDrop } from "../hooks/use-file-drop";
import {
  APP_TITLEBAR_HEIGHT,
  PEEK_SCALE,
  Z_DRAG_OVERLAY,
} from "../lib/constants";
import { useCameraStore } from "../store/camera-store";
import { useSettingsStore } from "../store/settings-store";

interface WorldProps {
  children: React.ReactNode;
  onFileDrop: (files: File[]) => void;
}

/**
 * The world container transforms via direct DOM style writes driven by
 * zustand subscriptions — avoids re-rendering on every animation frame.
 */
export const World = ({ children, onFileDrop }: WorldProps) => {
  const grid = useCameraStore((s) => s.grid);
  const { dragOver, dragHandlers } = useFileDrop({ onFileDrop });
  const worldRef = useRef<HTMLDivElement>(null);

  const worldW = grid.cols * grid.cellWidth;
  const worldH = grid.rows * grid.cellHeight;

  // Direct DOM transform writes — bypasses React on every animation frame.
  useEffect(() => {
    const apply = () => {
      const el = worldRef.current;
      if (!el) {
        return;
      }
      const { camera } = useCameraStore.getState();
      const peek = useSettingsStore.getState().settings.windowPeeking;
      el.style.transform = peek
        ? `translate3d(${-camera.x * PEEK_SCALE}px, ${-camera.y * PEEK_SCALE + APP_TITLEBAR_HEIGHT}px, 0) scale(${PEEK_SCALE})`
        : `translate3d(${-camera.x}px, ${-camera.y + APP_TITLEBAR_HEIGHT}px, 0)`;
    };
    apply();
    const unsubCam = useCameraStore.subscribe(apply);
    const unsubSet = useSettingsStore.subscribe(apply);
    return () => {
      unsubCam();
      unsubSet();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-[#0a0a0a]"
      {...dragHandlers}
    >
      {dragOver && (
        <div
          className="pointer-events-none fixed inset-0 flex items-center justify-center"
          style={{ zIndex: Z_DRAG_OVERLAY }}
        >
          <div className="rounded-2xl border-2 border-dashed border-white/30 bg-black/60 px-12 py-8 text-white/70 backdrop-blur-sm">
            Drop files to open
          </div>
        </div>
      )}

      <div
        ref={worldRef}
        className="absolute left-0"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              to right,
              rgba(255,255,255,0.06) 0px,
              rgba(255,255,255,0.06) 1px,
              transparent 1px,
              transparent ${grid.cellWidth}px
            ),
            repeating-linear-gradient(
              to bottom,
              rgba(255,255,255,0.06) 0px,
              rgba(255,255,255,0.06) 1px,
              transparent 1px,
              transparent ${grid.cellHeight}px
            )
          `,
          height: worldH,
          top: 0,
          transformOrigin: "0 0",
          width: worldW,
          willChange: "transform",
        }}
      >
        <div className="relative" style={{ zIndex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

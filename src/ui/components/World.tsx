import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
 * zustand subscriptions — the camera animation loop (60 Hz) no longer
 * re-renders this component or its ~200 grid lines.
 */
export const World = ({ children, onFileDrop }: WorldProps) => {
  const grid = useCameraStore((s) => s.grid);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);
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

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((_e: React.DragEvent) => {
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragOver(false);
      const files = [...e.dataTransfer.files];
      if (files.length > 0) {
        onFileDrop(files);
      }
    },
    [onFileDrop]
  );

  // Grid is static for a given grid size — rebuild only when dims change.
  const gridLines = useMemo(
    () => (
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ zIndex: 0 }}
      >
        {Array.from({ length: grid.cols + 1 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={i * grid.cellWidth}
            y1={0}
            x2={i * grid.cellWidth}
            y2={worldH}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: grid.rows + 1 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * grid.cellHeight}
            x2={worldW}
            y2={i * grid.cellHeight}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
      </svg>
    ),
    [grid.cellHeight, grid.cellWidth, grid.cols, grid.rows, worldH, worldW]
  );

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-[#0a0a0a]"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
          height: worldH,
          top: 0,
          transformOrigin: "0 0",
          width: worldW,
          willChange: "transform",
        }}
      >
        {gridLines}

        <div className="relative" style={{ zIndex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

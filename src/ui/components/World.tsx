import { useCallback, useRef, useState } from "react";
import { useStore } from "../store/windowStore";

interface WorldProps {
  children: React.ReactNode;
  onFileDrop: (files: File[]) => void;
}

export function World({ children, onFileDrop }: WorldProps) {
  const camera = useStore((s) => s.camera);
  const grid = useStore((s) => s.grid);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  const worldW = grid.cols * grid.cellWidth;
  const worldH = grid.rows * grid.cellHeight;

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((_e: React.DragEvent) => {
    dragCounter.current--;
    if (dragCounter.current === 0) setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFileDrop(files);
    },
    [onFileDrop]
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
        <div className="pointer-events-none fixed inset-0 z-9998 flex items-center justify-center">
          <div className="rounded-2xl border-2 border-dashed border-white/30 bg-black/60 px-12 py-8 text-white/70 backdrop-blur-sm">
            Drop files to open
          </div>
        </div>
      )}

      <div
        className="absolute left-0"
        style={{
          top: 32,
          width: worldW,
          height: worldH,
          transform: `translate3d(${-camera.x}px, ${-camera.y}px, 0)`,
          transformOrigin: "0 0",
        }}
      >
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

        <div className="relative" style={{ zIndex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";

import { useCameraStore } from "../store/camera-store";

const CELL_SIZE = 14;
const GAP = 1;
const HIDE_DELAY = 2500;

export const Minimap = () => {
  const grid = useCameraStore((s) => s.grid);
  const currentCell = useCameraStore((s) => s.currentCell);
  const moveToCell = useCameraStore((s) => s.moveToCell);

  const [hidden, setHidden] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timer = useRef<number | null>(null);

  const startHideTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => {
      if (!hovered) {
        setHidden(true);
      }
    }, HIDE_DELAY);
  }, [hovered]);

  const show = useCallback(() => {
    setHidden(false);
    startHideTimer();
  }, [startHideTimer]);

  useEffect(() => {
    startHideTimer();
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("[cmdk-root]")) {
        return;
      }
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        show();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [show, startHideTimer]);

  const handleMouseEnter = () => {
    setHovered(true);
    setHidden(false);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    startHideTimer();
  };

  const w = grid.cols * (CELL_SIZE + GAP);
  const h = grid.rows * (CELL_SIZE + GAP);

  return (
    <div className="fixed bottom-0 right-4 z-9999">
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`absolute bottom-0 left-1/2 h-3 w-16 -translate-x-1/2 rounded-t-full border border-white/10 border-b-0 bg-[#222] shadow-md shadow-black/30 transition-opacity ${
          hidden ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={show}
        className={`rounded-lg border border-white/10 bg-[#111] p-2 transition-transform duration-300 ease-in-out ${
          hidden ? "translate-y-full pointer-events-none" : "-translate-y-4"
        }`}
        style={{ height: h + 16, width: w + 16 }}
      >
        <div className="relative" style={{ height: h, width: w }}>
          {Array.from({ length: grid.rows }).map((_, row) =>
            Array.from({ length: grid.cols }).map((_col, col) => {
              const isCurrent = col === currentCell.x && row === currentCell.y;
              return (
                <button
                  type="button"
                  aria-label={`Cell ${col}, ${row}`}
                  key={`${col}-${row}`}
                  onClick={() => moveToCell(col, row)}
                  className="absolute border-none transition-colors"
                  style={{
                    background: isCurrent
                      ? "rgba(255,255,255,0.5)"
                      : "rgba(255,255,255,0.08)",
                    borderRadius: 2,
                    cursor: isCurrent ? "default" : "pointer",
                    height: CELL_SIZE,
                    left: col * (CELL_SIZE + GAP),
                    top: row * (CELL_SIZE + GAP),
                    width: CELL_SIZE,
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

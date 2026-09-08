import { useEffect, useState } from "react";

import { useAutoHide } from "../hooks/use-auto-hide";
import { Z_MINIMAP } from "../lib/constants";
import { useCameraStore } from "../store/camera-store";
import { AutoHidePill } from "./auto-hide-pill";

const CELL_SIZE = 14;
const GAP = 1;

export const Minimap = () => {
  const grid = useCameraStore((s) => s.grid);
  const currentCell = useCameraStore((s) => s.currentCell);
  const moveToCell = useCameraStore((s) => s.moveToCell);

  const [hovered, setHovered] = useState(false);
  const { hidden, show, startHideTimer } = useAutoHide(hovered);

  const handleMouseEnter = () => {
    setHovered(true);
    show();
  };

  const handleMouseLeave = () => {
    setHovered(false);
    startHideTimer();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("[cmdk-root]")) {
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
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [show]);

  const w = grid.cols * (CELL_SIZE + GAP);
  const h = grid.rows * (CELL_SIZE + GAP);

  return (
    <div className="fixed bottom-0 right-4" style={{ zIndex: Z_MINIMAP }}>
      <AutoHidePill hidden={hidden} onShow={show} position="bottom" />

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

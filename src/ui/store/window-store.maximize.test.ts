/**
 * Regression tests for maximizeWindow toggling. The click-vs-drag guard in
 * window.tsx depends on this store toggle behaving exactly as asserted.
 */
import { beforeEach, expect, it } from "vitest";

import { useCameraStore } from "./camera-store";
import { useWindowStore } from "./window-store";

beforeEach(() => {
  useCameraStore.setState({
    currentCell: { x: 0, y: 0 },
    grid: { cellHeight: 800, cellWidth: 1200, cols: 10, rows: 10 },
  });
  useWindowStore.getState().replaceWindows([]);
});

it("maximize then restore toggles bounds", () => {
  useWindowStore.getState().addWindow({
    h: 300,
    id: "w1",
    url: "https://example.com",
    w: 500,
    x: 10,
    y: 20,
  });
  const store = useWindowStore.getState();
  store.maximizeWindow("w1");
  let win = useWindowStore.getState().windows["w1"];
  expect(win?.maximized).toBe(true);
  expect(win?.w).toBe(1200);
  expect(win?.h).toBe(800);

  store.maximizeWindow("w1");
  win = useWindowStore.getState().windows["w1"];
  expect(win?.maximized).toBe(false);
  expect(win?.w).toBe(500);
  expect(win?.h).toBe(300);
  expect(win?.x).toBe(10);
  expect(win?.y).toBe(20);
});

it("maximize with no prior bounds falls back to defaults", () => {
  useWindowStore.getState().addWindow({
    h: 300,
    id: "w2",
    url: "https://example.com",
    w: 500,
    x: 10,
    y: 20,
  });
  const store = useWindowStore.getState();
  store.maximizeWindow("w2");
  useWindowStore.setState((s) => {
    const target = s.windows["w2"];
    if (!target) {
      return s;
    }
    return {
      windows: { ...s.windows, w2: { ...target, prevBounds: undefined } },
    };
  });
  store.maximizeWindow("w2");
  const win = useWindowStore.getState().windows["w2"];
  expect(win?.maximized).toBe(false);
  expect(win?.w).toBe(600);
  expect(win?.h).toBe(400);
});

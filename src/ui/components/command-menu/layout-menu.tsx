/** Palette page applying snap layouts to the active window. */

import { Command } from "cmdk";

import { useWindowStore } from "../../store/window-store";
import type { WindowLayout } from "../../utils/window-layouts";
import { WINDOW_LAYOUT_LABELS } from "../../utils/window-layouts";
import type { CloseProps } from "./command-menu";

const LAYOUTS: readonly WindowLayout[] = [
  "left_half",
  "right_half",
  "left_third",
  "center_third",
  "right_third",
  "top_left_quarter",
  "top_right_quarter",
  "bottom_left_quarter",
  "bottom_right_quarter",
];

export const LayoutMenu = ({ closeAndResetMenu }: CloseProps) => {
  const activeWindowId = useWindowStore((s) => s.activeWindowId);
  const setWindowLayout = useWindowStore((s) => s.setWindowLayout);

  const applyWindowLayout = (layout: WindowLayout) => {
    if (!activeWindowId) {
      closeAndResetMenu();
      return;
    }
    setWindowLayout(activeWindowId, layout);
    closeAndResetMenu();
  };

  return (
    <>
      {LAYOUTS.map((layout) => (
        <Command.Item
          key={layout}
          onSelect={() => applyWindowLayout(layout)}
          className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-[#eee] outline-none data-[selected=true]:bg-[#333]"
        >
          {WINDOW_LAYOUT_LABELS[layout]}
        </Command.Item>
      ))}
    </>
  );
};

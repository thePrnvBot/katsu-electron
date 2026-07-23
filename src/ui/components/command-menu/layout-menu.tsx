import { useWindowStore } from "../../store/window-store";
import type { WindowLayout } from "../../utils/window-layouts";
import type { CloseProps } from "./command-menu";
import { Command } from "cmdk";

const LAYOUTS: { readonly key: WindowLayout; readonly label: string }[] = [
  { key: "left_half", label: "Left Half" },
  { key: "right_half", label: "Right Half" },
  { key: "left_third", label: "Left One Third" },
  { key: "center_third", label: "Center One Third" },
  { key: "right_third", label: "Right One Third" },
  { key: "top_left_quarter", label: "Top Left Quarter" },
  { key: "top_right_quarter", label: "Top Right Quarter" },
  { key: "bottom_left_quarter", label: "Bottom Left Quarter" },
  { key: "bottom_right_quarter", label: "Bottom Right Quarter" },
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
      {LAYOUTS.map(({ key, label }) => (
        <Command.Item
          key={key}
          onSelect={() => applyWindowLayout(key)}
          className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-[#eee] outline-none data-[selected=true]:bg-[#333]"
        >
          {label}
        </Command.Item>
      ))}
    </>
  );
};

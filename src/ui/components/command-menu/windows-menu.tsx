import{ Command } from "cmdk";
import { useCenterOnWindow } from "../../hooks/use-center-window";
import { useWindowStore } from "../../store/window-store";
import type { CloseProps } from "./command-menu";

export const WindowsMenu = ({ closeAndResetMenu }: CloseProps) => {
  const windows = useWindowStore((s) => s.windows);
  const setActiveWindow = useWindowStore((s) => s.setActiveWindow);
  const centerOnWindow = useCenterOnWindow();

  const goToWindow = (id: string) => {
    centerOnWindow(id);
    setActiveWindow(id);
    closeAndResetMenu();
  };

  return (
    <>
      <Command.Empty className="px-3 py-2 text-sm text-white/40">
        No windows found.
      </Command.Empty>
      {windows.map((w) => (
        <Command.Item
          key={w.id}
          value={`${w.fileName ?? w.url} ${w.id}`}
          onSelect={() => goToWindow(w.id)}
          className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-[#eee] outline-none data-[selected=true]:bg-[#333]"
        >
          {w.fileName ?? w.url}
        </Command.Item>
      ))}
    </>
  );
};

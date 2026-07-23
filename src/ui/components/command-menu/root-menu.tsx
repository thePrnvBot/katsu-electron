import { Command } from "cmdk";
import type { CommandPages } from "./command-menu";
import { useWindowStore } from "../../store/window-store";

interface RootMenuProps {
  navigateToPage: (page: CommandPages) => void;
  closeAndResetMenu: () => void;
}

export const RootMenu = ({ navigateToPage, closeAndResetMenu }: RootMenuProps) => {
  const closeAllWindows = useWindowStore(
    (s) => s.closeAllWindows
  );

  function handleCloseAllWindows(): void {
    closeAllWindows();
    closeAndResetMenu();
  }

  return (
  <>
    <Command.Empty className="px-3 py-2 text-sm text-white/40">
      No results found.
    </Command.Empty>
    <Command.Item
      onSelect={() => navigateToPage("windows")}
      className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-[#eee] outline-none data-[selected=true]:bg-[#333]"
    >
      Search Windows
    </Command.Item>
    <Command.Item
      onSelect={() => navigateToPage("layout")}
      className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-[#eee] outline-none data-[selected=true]:bg-[#333]"
    >
      Set Window Layout
    </Command.Item>
    <Command.Item
      onSelect={() => navigateToPage("settings")}
      className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-[#eee] outline-none data-[selected=true]:bg-[#333]"
    >
      Settings
    </Command.Item>
    <Command.Item
      onSelect={() => handleCloseAllWindows()}
      className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-[#eee] outline-none data-[selected=true]:bg-[#333]"
    >
      Close All Windows
    </Command.Item>
    </>
  )
};

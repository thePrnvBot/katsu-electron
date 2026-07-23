import { Command } from "cmdk";
import { useEffect, useState } from "react";

import { Z_COMMAND_MENU } from "../../lib/constants";
import { WindowsMenu } from "./windows-menu";
import { LayoutMenu } from "./layout-menu";
import { SettingsMenu } from "./settings-menu";
import { RootMenu } from "./root-menu";

export interface CloseProps {
  closeAndResetMenu: () => void;
}

export type CommandPages = "root" | "windows" | "layout" | "settings";

export const CommandMenu = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pages, setPages] = useState<CommandPages[]>(["root"]);
  const page = pages.at(-1);

  const navigateToPage = (p: CommandPages) => {
    setSearch("");
    setPages((s) => [...s, p]);
  };

  const goBackToPreviousPage = () => {
    setPages((p) => (p.length > 1 ? p.slice(0, -1) : p));
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const resetMenu = () => {
    setSearch("");
    setPages(["root"]);
  };

  const closeAndResetMenu = () => {
    setOpen(false);
    resetMenu();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          resetMenu();
        }
      }}
      label="Global Command Menu"
      className="fixed top-[20%] left-1/2 w-full max-w-lg -translate-x-1/2 rounded-2xl border border-white/10 bg-[#222] p-2 shadow-lg shadow-black/30 backdrop-blur-sm"
      style={{ zIndex: Z_COMMAND_MENU }}
      onKeyDown={(e) => {
        // Escape only goes back when there is a page to go back to;
        // otherwise let cmdk close the dialog.
        if (e.key === "Escape" && pages.length > 1) {
          e.preventDefault();
          goBackToPreviousPage();
          return;
        }
        if (e.key === "Backspace" && !search) {
          e.preventDefault();
          goBackToPreviousPage();
        }
      }}
    >
      {page !== "root" && (
        <div className="flex items-center gap-2 px-2 pb-2">
          <button
            type="button"
            onClick={goBackToPreviousPage}
            className="text-xs text-white/40 hover:text-white/70"
          >
            &#8592; Back
          </button>
        </div>
      )}
      <Command.Input
        autoFocus
        value={search}
        onValueChange={setSearch}
        placeholder="Search..."
        className="h-10 w-full rounded-xl bg-[#333] px-4 text-sm text-[#eee] placeholder-white/40 outline-none"
      />
      <Command.List className="mt-2 max-h-64 overflow-y-auto">
        {page === "root" && <RootMenu navigateToPage={navigateToPage} closeAndResetMenu={closeAndResetMenu}/>}
        {page === "windows" && (
          <WindowsMenu closeAndResetMenu={closeAndResetMenu} />
        )}
        {page === "layout" && (
          <LayoutMenu closeAndResetMenu={closeAndResetMenu} />
        )}
        {page === "settings" && (
          <SettingsMenu closeAndResetMenu={closeAndResetMenu} />
        )}
      </Command.List>
    </Command.Dialog>
  );
};

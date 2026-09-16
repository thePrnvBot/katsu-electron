/** Global command palette (Cmd/Ctrl+K) with nested pages. */

import { Command } from "cmdk";
import { useEffect, useState } from "react";

import { Z_COMMAND_MENU } from "../../lib/constants";
import { useCommandMenuStore } from "../../store/command-menu-store";
import {
  describeBangCommand,
  parseBangCommand,
} from "../../utils/bang-command";
import { executeBangCommand } from "../../utils/run-bang-command";
import { GenerateMenu } from "./generate-menu";
import { LayoutMenu } from "./layout-menu";
import { RootMenu } from "./root-menu";
import { SettingsMenu } from "./settings-menu";
import { WindowsMenu } from "./windows-menu";
import { WorkspaceMenu } from "./workspace-menu";

export interface CloseProps {
  closeAndResetMenu: () => void;
}

interface CommandMenuProps {
  openTerminal: () => void;
}

export const CommandMenu = ({ openTerminal }: CommandMenuProps) => {
  const open = useCommandMenuStore((s) => s.open);
  const search = useCommandMenuStore((s) => s.search);
  const pages = useCommandMenuStore((s) => s.pages);
  const setOpen = useCommandMenuStore((s) => s.setOpen);
  const setSearch = useCommandMenuStore((s) => s.setSearch);
  const pushPage = useCommandMenuStore((s) => s.pushPage);
  const popPage = useCommandMenuStore((s) => s.popPage);
  const reset = useCommandMenuStore((s) => s.reset);
  const page = pages.at(-1);
  const parsedBang = parseBangCommand(search);
  const bangPreview = parsedBang ? describeBangCommand(parsedBang) : null;
  const [bangError, setBangError] = useState<string | null>(null);

  const closeAndResetMenu = () => {
    setBangError(null);
    setOpen(false);
    reset();
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Match the physical key (`e.code`) so non-Latin keyboard layouts
      // (e.g. Cyrillic) still toggle the menu; Caps Lock changes `e.key`.
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.code === "KeyK" || e.key.toLowerCase() === "k")
      ) {
        e.preventDefault();
        setOpen(!useCommandMenuStore.getState().open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  return (
    <Command.Dialog
      open={open}
      shouldFilter={page !== "workspace"}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setBangError(null);
          reset();
        }
      }}
      label="Global Command Menu"
      className="fixed top-[18%] left-1/2 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#1e1e1e]/95 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl"
      style={{ zIndex: Z_COMMAND_MENU }}
      onKeyDown={(e) => {
        // Escape only goes back when there is a page to go back to;
        // otherwise let cmdk close the dialog.
        if (e.key === "Escape" && pages.length > 1) {
          e.preventDefault();
          popPage();
          return;
        }
        if (e.key === "Backspace" && !search) {
          e.preventDefault();
          popPage();
        }
      }}
    >
      {page !== "root" && (
        <div className="flex items-center gap-2 px-2 pb-2">
          <button
            type="button"
            onClick={popPage}
            className="text-xs text-white/40 transition hover:text-white/70"
          >
            &#8592; Back
          </button>
        </div>
      )}
      <Command.Input
        autoFocus
        value={search}
        onValueChange={(value) => {
          setSearch(value);
          setBangError(null);
        }}
        onKeyDown={(e) => {
          // A `!command` here runs directly instead of selecting an item.
          if (e.key !== "Enter") {
            return;
          }
          const command = parseBangCommand(search);
          if (!command) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          void (async () => {
            try {
              const outcome = await executeBangCommand(command);
              if (outcome.message !== null) {
                setBangError(outcome.message);
                return;
              }
              if (outcome.close) {
                closeAndResetMenu();
              }
            } catch {
              setBangError("That command could not run.");
            }
          })();
        }}
        placeholder="Search or !command..."
        className="h-11 w-full rounded-xl border border-white/5 bg-[#2a2a2a] px-4 text-sm text-[#eee] placeholder-white/35 outline-none transition focus:border-white/15"
      />
      {bangError === null ? (
        bangPreview !== null && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/60">
              !
            </span>
            <span className="min-w-0 flex-1 truncate">{bangPreview}</span>
            <span className="shrink-0 text-[10px] text-white/40">
              &#8629; run
            </span>
          </div>
        )
      ) : (
        <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {bangError}
        </div>
      )}
      <Command.List className="mt-2 max-h-72 overflow-y-auto">
        {page === "root" && (
          <RootMenu
            navigateToPage={pushPage}
            closeAndResetMenu={closeAndResetMenu}
            openTerminal={openTerminal}
          />
        )}
        {page === "windows" && (
          <WindowsMenu closeAndResetMenu={closeAndResetMenu} />
        )}
        {page === "layout" && (
          <LayoutMenu closeAndResetMenu={closeAndResetMenu} />
        )}
        {page === "settings" && (
          <SettingsMenu closeAndResetMenu={closeAndResetMenu} />
        )}
        {page === "generate" && (
          <GenerateMenu closeAndResetMenu={closeAndResetMenu} />
        )}
        {page === "workspace" && (
          <WorkspaceMenu
            closeAndResetMenu={closeAndResetMenu}
            search={search}
          />
        )}
      </Command.List>
      <div className="mt-2 flex items-center justify-between border-t border-white/5 px-3 pt-2 pb-0.5 text-[10px] text-white/30">
        <span>&#8593;&#8595; navigate</span>
        <span>&#8629; select &middot; esc close</span>
      </div>
    </Command.Dialog>
  );
};

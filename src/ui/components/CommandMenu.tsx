import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useStore } from "../store/windowStore";

type CommandPages = "root" | "windows" | "layout";

interface SubMenuProps {
  navigateToPage: (page: CommandPages) => void;
  closeAndResetMenu: () => void;
}

function RootMenu({ navigateToPage }: SubMenuProps) {
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
    </>
  );
}

function WindowsMenu({ closeAndResetMenu }: SubMenuProps) {
  const windows = useStore((s) => s.windows);
  const centerOnWindow = useStore((s) => s.centerOnWindow);
  const setActiveWindow = useStore((s) => s.setActiveWindow);

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
}

function LayoutMenu({ closeAndResetMenu }: SubMenuProps) {
  const activeWindowId = useStore((s) => s.activeWindowId);
  const setWindowLayout = useStore((s) => s.setWindowLayout);

  type LayoutItem = { key: string; label: string };

  const LAYOUTS: LayoutItem[] = [
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

  const applyWindowLayout = (layout: string) => {
    if (!activeWindowId) {
      closeAndResetMenu();
      return;
    }
    setWindowLayout(
      activeWindowId,
      layout as
        | "left_half"
        | "right_half"
        | "left_third"
        | "center_third"
        | "right_third"
        | "top_left_quarter"
        | "top_right_quarter"
        | "bottom_left_quarter"
        | "bottom_right_quarter"
    );
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
}

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pages, setPages] = useState<CommandPages[]>(["root"]);
  const page = pages[pages.length - 1];

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
        if (!isOpen) resetMenu();
      }}
      label="Global Command Menu"
      className="fixed top-[20%] left-1/2 z-99999 w-full max-w-lg -translate-x-1/2 rounded-2xl border border-white/10 bg-[#222] p-2 shadow-lg shadow-black/30 backdrop-blur-sm"
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Backspace" && !search)) {
          e.preventDefault();
          goBackToPreviousPage();
        }
      }}
    >
      {page !== "root" && (
        <div className="flex items-center gap-2 px-2 pb-2">
          <button
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
        {page === "root" && (
          <RootMenu
            navigateToPage={navigateToPage}
            closeAndResetMenu={closeAndResetMenu}
          />
        )}
        {page === "windows" && (
          <WindowsMenu
            navigateToPage={navigateToPage}
            closeAndResetMenu={closeAndResetMenu}
          />
        )}
        {page === "layout" && (
          <LayoutMenu
            navigateToPage={navigateToPage}
            closeAndResetMenu={closeAndResetMenu}
          />
        )}
      </Command.List>
    </Command.Dialog>
  );
}

/** Command palette open/page state, so bang commands can drive it too. */

import { create } from "zustand";

export type CommandPages =
  | "root"
  | "windows"
  | "layout"
  | "settings"
  | "generate"
  | "workspace";

interface CommandMenuState {
  open: boolean;
  pages: CommandPages[];
  search: string;
  setOpen: (open: boolean) => void;
  setSearch: (search: string) => void;
  pushPage: (page: CommandPages) => void;
  popPage: () => void;
  reset: () => void;
  /** Open the palette directly on a page, optionally pre-filled. */
  openAt: (page: CommandPages, query?: string) => void;
}

export const useCommandMenuStore = create<CommandMenuState>((set) => ({
  open: false,
  openAt: (page, query = "") =>
    set({ open: true, pages: ["root", page], search: query }),
  pages: ["root"],
  popPage: () =>
    set((state) =>
      state.pages.length > 1 ? { pages: state.pages.slice(0, -1) } : state
    ),
  pushPage: (page) =>
    set((state) => ({ pages: [...state.pages, page], search: "" })),
  reset: () => set({ pages: ["root"], search: "" }),
  search: "",
  setOpen: (open) => set({ open }),
  setSearch: (search) => set({ search }),
}));

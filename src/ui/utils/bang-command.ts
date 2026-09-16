/** Parses `!command` bang shortcuts typed into the search bar. */

import type { WindowLayout } from "./window-layouts";
import { WINDOW_LAYOUT_LABELS } from "./window-layouts";

export type BangCommand =
  | { readonly kind: "window-layout"; readonly layout: WindowLayout | null }
  | { readonly kind: "search"; readonly query: string }
  | { readonly kind: "workspace"; readonly query: string }
  | { readonly kind: "terminal" }
  | { readonly kind: "close-all" }
  | { readonly kind: "generate"; readonly prompt: string }
  | { readonly kind: "unknown"; readonly token: string };

/**
 * Layout aliases derived from `WINDOW_LAYOUT_LABELS`, so `!wl lh` and
 * `!wl left_half` both work and new layouts need no alias maintenance.
 * Produces the snake id, the kebab slug, the two-word initials, and — when
 * more than two words remain (filler "one" ignored) — the full initials
 * (e.g. `blq`).
 */
const LAYOUT_ALIASES = new Map<string, WindowLayout>(
  Object.entries(WINDOW_LAYOUT_LABELS).flatMap(([layout, label]) => {
    const words = label
      .toLowerCase()
      .split(" ")
      .filter((word) => word !== "one");
    const initials = words.map((word) => word[0]).join("");
    const aliases = [
      layout,
      words.join("-"),
      initials.slice(0, 2),
      ...(words.length > 2 ? [initials] : []),
    ];
    // SAFETY: `WINDOW_LAYOUT_LABELS` keys are exactly `WindowLayout`.
    return aliases.map((alias) => [alias, layout as WindowLayout] as const);
  })
);

/** Null when the input is not a bang command (a normal URL/search). */
export const parseBangCommand = (input: string): BangCommand | null => {
  const trimmedInput = input.trim();
  if (!trimmedInput.startsWith("!")) {
    return null;
  }

  const [commandToken = "", ...argumentParts] = trimmedInput
    .slice(1)
    .trim()
    .split(/\s+/u);
  const argument = argumentParts.join(" ").trim();

  switch (commandToken.toLowerCase()) {
    case "s": {
      return { kind: "search", query: argument };
    }
    case "t": {
      return { kind: "terminal" };
    }
    case "cls": {
      return { kind: "close-all" };
    }
    case "ws": {
      return { kind: "workspace", query: argument };
    }
    case "g": {
      return { kind: "generate", prompt: argument };
    }
    case "wl": {
      if (argument.length === 0) {
        return { kind: "window-layout", layout: null };
      }
      const layout = LAYOUT_ALIASES.get(argument.toLowerCase()) ?? null;
      return { kind: "window-layout", layout };
    }
    default: {
      return { kind: "unknown", token: commandToken };
    }
  }
};

/** One-line description of what a command will do; null when unrecognized. */
export const describeBangCommand = (command: BangCommand): string | null => {
  switch (command.kind) {
    case "window-layout": {
      return command.layout === null
        ? "Choose a window layout"
        : `Snap active window: ${WINDOW_LAYOUT_LABELS[command.layout]}`;
    }
    case "search": {
      return command.query.length > 0
        ? `Search windows: ${command.query}`
        : "Search windows";
    }
    case "workspace": {
      return command.query.length > 0
        ? `Workspaces: ${command.query}`
        : "Open workspaces";
    }
    case "terminal": {
      return "Open a terminal";
    }
    case "close-all": {
      return "Close all windows";
    }
    case "generate": {
      return command.prompt.length > 0
        ? `Generate artifact: ${command.prompt}`
        : "Generate an artifact";
    }
    case "unknown": {
      return null;
    }
    default: {
      return null;
    }
  }
};

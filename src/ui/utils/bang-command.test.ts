/** Tests for bang-command parsing. */

import { describe, expect, it } from "vitest";

import { describeBangCommand, parseBangCommand } from "./bang-command";

describe("parseBangCommand", () => {
  it("returns null for normal URLs and searches", () => {
    expect(parseBangCommand("https://example.com")).toBeNull();
    expect(parseBangCommand("hello world")).toBeNull();
  });

  it("parses simple commands", () => {
    expect(parseBangCommand("!t")).toEqual({ kind: "terminal" });
    expect(parseBangCommand("!cls")).toEqual({ kind: "close-all" });
  });

  it("parses layout initials, ids, and case-insensitively", () => {
    expect(parseBangCommand("!wl lh")).toEqual({
      kind: "window-layout",
      layout: "left_half",
    });
    expect(parseBangCommand("!wl RH")).toEqual({
      kind: "window-layout",
      layout: "right_half",
    });
    expect(parseBangCommand("!wl ct")).toEqual({
      kind: "window-layout",
      layout: "center_third",
    });
    expect(parseBangCommand("!wl brq")).toEqual({
      kind: "window-layout",
      layout: "bottom_right_quarter",
    });
    expect(parseBangCommand("!wl left_half")).toEqual({
      kind: "window-layout",
      layout: "left_half",
    });
  });

  it("opens the layout page when no or unknown layout is given", () => {
    expect(parseBangCommand("!wl")).toEqual({
      kind: "window-layout",
      layout: null,
    });
    expect(parseBangCommand("!wl nope")).toEqual({
      kind: "window-layout",
      layout: null,
    });
  });

  it("parses generate prompts with spaces", () => {
    expect(parseBangCommand("!g make a todo app")).toEqual({
      kind: "generate",
      prompt: "make a todo app",
    });
    expect(parseBangCommand("!g")).toEqual({ kind: "generate", prompt: "" });
  });

  it("parses search and workspace arguments", () => {
    expect(parseBangCommand("!s docs")).toEqual({
      kind: "search",
      query: "docs",
    });
    expect(parseBangCommand("!ws My Setup")).toEqual({
      kind: "workspace",
      query: "My Setup",
    });
  });

  it("reports unknown commands", () => {
    expect(parseBangCommand("!xyz")).toEqual({
      kind: "unknown",
      token: "xyz",
    });
  });
});

describe("describeBangCommand", () => {
  it("describes recognized commands", () => {
    expect(describeBangCommand({ kind: "terminal" })).toBe("Open a terminal");
    expect(
      describeBangCommand({ kind: "window-layout", layout: "left_half" })
    ).toBe("Snap active window: Left Half");
    expect(
      describeBangCommand({ kind: "generate", prompt: "a todo app" })
    ).toBe("Generate artifact: a todo app");
    expect(describeBangCommand({ kind: "search", query: "" })).toBe(
      "Search windows"
    );
  });

  it("returns null for unknown commands", () => {
    expect(describeBangCommand({ kind: "unknown", token: "xyz" })).toBeNull();
  });
});

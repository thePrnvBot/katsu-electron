/** Tests for the window persistence predicate. */

import { describe, expect, it } from "vitest";

import { isPersistableWindow } from "./window-metadata";

describe("isPersistableWindow", () => {
  it("rejects preview windows (temp URLs) and generation windows", () => {
    expect(isPersistableWindow({ kind: "webview", previewType: "html" })).toBe(
      false
    );
    expect(isPersistableWindow({ kind: "generation" })).toBe(false);
  });

  it("accepts webviews, terminals, and legacy metadata without a kind", () => {
    expect(isPersistableWindow({ kind: "webview" })).toBe(true);
    expect(isPersistableWindow({ kind: "terminal" })).toBe(true);
    expect(isPersistableWindow({})).toBe(true);
  });
});

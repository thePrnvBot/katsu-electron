/** Tests for project-name derivation. */

import { describe, expect, it } from "vitest";

import { projectNameFromPrompt } from "./project-name";

describe("projectNameFromPrompt", () => {
  it("uses the first line, collapsed and stripped of trailing punctuation", () => {
    expect(projectNameFromPrompt("  A to-do app.  ")).toBe("A to-do app");
  });

  it("ignores later lines", () => {
    expect(projectNameFromPrompt("Pricing page\nwith three tiers")).toBe(
      "Pricing page"
    );
  });

  it("falls back for an empty prompt", () => {
    expect(projectNameFromPrompt("   \n  ")).toBe("Untitled project");
  });

  it("truncates very long prompts with an ellipsis", () => {
    const name = projectNameFromPrompt("x".repeat(120));
    expect(name.length).toBeLessThanOrEqual(48);
    expect(name.endsWith("…")).toBe(true);
  });
});

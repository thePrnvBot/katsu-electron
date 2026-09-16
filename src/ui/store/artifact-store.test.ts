/** Tests for the parallel-generation bookkeeping. */

import { describe, expect, it } from "vitest";

import {
  countRunningGenerations,
  MAX_PARALLEL_GENERATIONS,
} from "./artifact-store";

const generation = (id: string, status: "running" | "done" | "error") =>
  ({
    error: null,
    generationId: id,
    projectName: "Project",
    prompt: "a project",
    providerId: "opencode",
    providerLabel: "OpenCode",
    status,
    windowId: id,
  }) as const;

describe("countRunningGenerations", () => {
  it("counts only running generations", () => {
    expect(
      countRunningGenerations({
        a: generation("a", "running"),
        b: generation("b", "done"),
        c: generation("c", "running"),
        d: generation("d", "error"),
      })
    ).toBe(2);
  });

  it("is zero for an empty set", () => {
    expect(countRunningGenerations({})).toBe(0);
  });

  it("allows more than one concurrent run", () => {
    expect(MAX_PARALLEL_GENERATIONS).toBeGreaterThan(1);
  });
});

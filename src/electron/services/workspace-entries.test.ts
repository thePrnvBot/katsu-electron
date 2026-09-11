/** Tests for workspace library upsert and removal. */

import { describe, expect, it } from "vitest";

import type { WindowMetadata } from "../../shared/contract";
import { removeWorkspace, upsertWorkspace } from "./workspace-entries";

const windowMetadata = (id: string): WindowMetadata => ({
  bounds: { height: 300, width: 400, x: 0, y: 0 },
  id,
  url: `https://example.com/${id}`,
  zIndex: 1,
});

describe("upsertWorkspace", () => {
  it("appends a new workspace", () => {
    const result = upsertWorkspace([], "Work", [windowMetadata("a")]);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Work");
  });

  it("replaces an existing workspace with the same name", () => {
    const first = upsertWorkspace([], "Work", [windowMetadata("a")]);
    const result = upsertWorkspace(first, "Work", [windowMetadata("b")]);
    expect(result).toHaveLength(1);
    expect(result[0]?.windows[0]?.id).toBe("b");
  });

  it("keeps other workspaces in order", () => {
    const base = upsertWorkspace([], "A", [windowMetadata("a")]);
    const result = upsertWorkspace(base, "B", [windowMetadata("b")]);
    expect(result.map((entry) => entry.name)).toEqual(["A", "B"]);
  });

  it("does not mutate the input", () => {
    const base = upsertWorkspace([], "A", []);
    upsertWorkspace(base, "B", []);
    expect(base).toHaveLength(1);
  });
});

describe("removeWorkspace", () => {
  it("removes by name and keeps the rest", () => {
    const base = upsertWorkspace(upsertWorkspace([], "A", []), "B", []);
    expect(removeWorkspace(base, "A").map((entry) => entry.name)).toEqual([
      "B",
    ]);
  });

  it("is a no-op for unknown names", () => {
    const base = upsertWorkspace([], "A", []);
    expect(removeWorkspace(base, "missing")).toHaveLength(1);
  });

  it("does not mutate the input", () => {
    const base = upsertWorkspace([], "A", []);
    removeWorkspace(base, "A");
    expect(base).toHaveLength(1);
  });
});

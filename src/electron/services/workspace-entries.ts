import type { WindowMetadata } from "../../shared/contract.js";

/** One named window setup stored in `workspaces.json`. */
export interface WorkspaceEntry {
  readonly name: string;
  readonly windows: readonly WindowMetadata[];
}

/** Insert or overwrite an entry by name, keeping the rest in order. */
export const upsertWorkspace = (
  existing: readonly WorkspaceEntry[],
  name: string,
  windows: readonly WindowMetadata[]
): WorkspaceEntry[] => {
  const remaining: WorkspaceEntry[] = [...existing].filter(
    (entry) => entry.name !== name
  );
  remaining.push({ name, windows });
  return remaining;
};

/** Remove an entry by name (no-op when the name is absent). */
export const removeWorkspace = (
  existing: readonly WorkspaceEntry[],
  name: string
): WorkspaceEntry[] => [...existing].filter((entry) => entry.name !== name);

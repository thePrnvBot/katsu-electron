/** Drift guard: the sandboxed preload inlines the IPC channel names, since
 * sandboxed preloads cannot require local modules. This test fails when the
 * inline map in `preload.cts` and the shared source `ipc-channels.ts` drift. */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { IpcChannel } from "./../shared/ipc-channels.js";

const readSource = (relativePath: string): string =>
  readFileSync(path.join(import.meta.dirname, relativePath), "utf-8");

/** Extract every `"ns:name"` literal inside the inlined IpcChannel map. */
const extractChannelLiterals = (source: string): Set<string> => {
  const blockMatch = /const IpcChannel = \{(?<block>[\s\S]*?)\} as const/u.exec(
    source
  );
  const block = blockMatch?.groups?.block;
  if (block === undefined) {
    throw new Error("Inlined IpcChannel map not found in preload.cts");
  }
  const literals = new Set<string>();
  for (const match of block.matchAll(/"(?<channel>[a-z-]+:[a-zA-Z]+)"/gu)) {
    const literal = match.groups?.channel;
    if (literal !== undefined) {
      literals.add(literal);
    }
  }
  return literals;
};

describe("preload channel sync", () => {
  it("inline IpcChannel map matches src/shared/ipc-channels.ts", () => {
    const preloadSource = readSource("./preload.cts");
    const shared = new Set(Object.values(IpcChannel));

    const inline = extractChannelLiterals(preloadSource);
    // Only literals under the inlined map matter; keep the comparison to
    // channels, not other strings in the file.
    for (const channel of shared) {
      expect(inline.has(channel), `missing in preload: ${channel}`).toBe(true);
    }
    for (const channel of inline) {
      expect(
        shared.has(channel),
        `stale in preload (not in shared): ${channel}`
      ).toBe(true);
    }
  });
});

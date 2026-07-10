import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import { app } from "electron";
import path from "path";
import fs from "fs/promises";

const FILTER_LISTS = [
  {
    name: "ublock-filters",
    file: "ublock-filters.txt",
  },
  {
    name: "ublock-privacy",
    file: "ublock-privacy.txt",
  },
  {
    name: "ublock-unbreak",
    file: "ublock-unbreak.txt",
  },
  {
    name: "easylist",
    file: "easylist.txt",
  },
  {
    name: "easyprivacy",
    file: "easyprivacy.txt",
  },
];

const TYPE_MAP: Record<string, string> = {
  mainFrame: "main_frame",
  subFrame: "sub_frame",
  xhr: "xmlhttprequest",
  cspReport: "csp_report",
  webSocket: "websocket",
};

const CACHE_FILE = path.join(app.getPath("userData"), "adblock-cache.json");
const FILTERS_DIR = path.join(
  app.getAppPath(),
  "dist-electron",
  "filters"
);

export interface AdBlocker {
  readonly init: Effect.Effect<void, Error>;
  readonly matchRequest: (details: {
    url: string;
    originURL: string;
    type: string;
    method: string;
  }) => Effect.Effect<boolean>;
  readonly getBlockedCount: Effect.Effect<number>;
  readonly resetBlockedCount: Effect.Effect<void>;
}

export const AdBlocker = Context.GenericTag<AdBlocker>("AdBlocker");

let snfe: {
  matchRequest(details: {
    originURL: string;
    url: string;
    type: string;
    method: string;
  }): number;
  serialize(): Promise<string>;
  deserialize(selfie: string): Promise<void>;
  useLists(lists: Array<{ name: string; raw: string }>): Promise<void>;
} | null = null;
let blockedCount = 0;

async function loadFromCache(): Promise<string | null> {
  try {
    const data = await fs.readFile(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(data);
    if (parsed.version === 1 && typeof parsed.selfie === "string") {
      return parsed.selfie;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveToCache(selfie: string): Promise<void> {
  try {
    await fs.writeFile(
      CACHE_FILE,
      JSON.stringify({ version: 1, selfie }),
      "utf-8"
    );
  } catch {
    // non-critical
  }
}

async function loadBundledLists(): Promise<
  Array<{ name: string; raw: string }>
> {
  const results: Array<{ name: string; raw: string }> = [];

  for (const list of FILTER_LISTS) {
    try {
      const filePath = path.join(FILTERS_DIR, list.file);
      const raw = await fs.readFile(filePath, "utf-8");
      results.push({ name: list.name, raw });
    } catch {
      // skip missing bundled list
    }
  }

  return results;
}

export const AdBlockerLive = Layer.succeed(AdBlocker, {
  init: Effect.tryPromise({
    try: async () => {
      const { StaticNetFilteringEngine } = await import("@gorhill/ubo-core");
      snfe = await StaticNetFilteringEngine.create();

      const cached = await loadFromCache();
      if (cached) {
        await snfe.deserialize(cached);
        return;
      }

      const lists = await loadBundledLists();
      if (lists.length > 0) {
        await snfe.useLists(lists);
        const selfie = await snfe.serialize();
        await saveToCache(selfie);
      }
    },
    catch: () => new Error("Failed to initialize ad blocker"),
  }),

  matchRequest: (details) =>
    Effect.sync(() => {
      if (!snfe) return false;
      try {
        const mappedType = TYPE_MAP[details.type] || details.type;
        const blocked =
          snfe.matchRequest({
            originURL: details.originURL,
            url: details.url,
            type: mappedType,
            method: details.method,
          }) !== 0;
        if (blocked) blockedCount++;
        return blocked;
      } catch {
        return false;
      }
    }),

  getBlockedCount: Effect.sync(() => blockedCount),

  resetBlockedCount: Effect.sync(() => {
    blockedCount = 0;
  }),
});

import fs from "node:fs/promises";
import path from "node:path";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { app } from "electron";

import { getUserData } from "../util.js";

const FILTER_LISTS = [
  {
    file: "ublock-filters.txt",
    name: "ublock-filters",
  },
  {
    file: "ublock-privacy.txt",
    name: "ublock-privacy",
  },
  {
    file: "ublock-unbreak.txt",
    name: "ublock-unbreak",
  },
  {
    file: "easylist.txt",
    name: "easylist",
  },
  {
    file: "easyprivacy.txt",
    name: "easyprivacy",
  },
];

const TYPE_MAP: Record<string, string> = {
  cspReport: "csp_report",
  mainFrame: "main_frame",
  subFrame: "sub_frame",
  webSocket: "websocket",
  xhr: "xmlhttprequest",
};

const CACHE_FILE = getUserData("adblock-cache.json");
const FILTERS_DIR = path.join(app.getAppPath(), "dist-electron", "filters");

export interface AdBlocker {
  readonly init: Effect.Effect<void, Error>;
  readonly matchRequest: (details: {
    url: string;
    originURL: string;
    type: string;
    method: string;
  }) => Effect.Effect<boolean>;
  readonly getBlockedCountForOrigin: (origin: string) => Effect.Effect<number>;
  readonly resetBlockedCountForOrigin: (origin: string) => Effect.Effect<void>;
}

export const AdBlocker = Context.GenericTag<AdBlocker>("AdBlocker");

let snfe: {
  matchRequest: (details: {
    originURL: string;
    url: string;
    type: string;
    method: string;
  }) => number;
  serialize: () => Promise<string>;
  deserialize: (selfie: string) => Promise<void>;
  useLists: (lists: { name: string; raw: string }[]) => Promise<void>;
} | null = null;
const perOriginCounts = new Map<string, number>();

const loadFromCache = async (): Promise<string | null> => {
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
};

const saveToCache = async (selfie: string): Promise<void> => {
  try {
    await fs.writeFile(
      CACHE_FILE,
      JSON.stringify({ selfie, version: 1 }),
      "utf-8"
    );
  } catch {
    // non-critical
  }
};

const loadBundledLists = async (): Promise<{ name: string; raw: string }[]> => {
  const results = await Promise.all(
    FILTER_LISTS.map(async (list) => {
      try {
        const filePath = path.join(FILTERS_DIR, list.file);
        const raw = await fs.readFile(filePath, "utf-8");
        return { name: list.name, raw };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is { name: string; raw: string } => r !== null);
};

export const AdBlockerLive = Layer.succeed(AdBlocker, {
  getBlockedCountForOrigin: (origin) =>
    Effect.sync(() => perOriginCounts.get(origin) ?? 0),

  init: Effect.tryPromise({
    catch: () => new Error("Failed to initialize ad blocker"),
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
  }),

  matchRequest: (details) =>
    Effect.sync(() => {
      if (!snfe) {
        return false;
      }
      try {
        const mappedType = TYPE_MAP[details.type] || details.type;
        const blocked =
          snfe.matchRequest({
            method: details.method,
            originURL: details.originURL,
            type: mappedType,
            url: details.url,
          }) !== 0;
        if (blocked) {
          const { origin } = new URL(details.originURL);
          perOriginCounts.set(origin, (perOriginCounts.get(origin) ?? 0) + 1);
        }
        return blocked;
      } catch {
        return false;
      }
    }),

  resetBlockedCountForOrigin: (origin) =>
    Effect.sync(() => {
      perOriginCounts.delete(origin);
    }),
});

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { app } from "electron";

import { getAdBlockCacheFilePath } from "../util.js";

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

/**
 * Bumped when the cache shape changes. Content changes to the bundled
 * filter lists are caught by the content fingerprint instead.
 */
const CACHE_VERSION = 2;

/** Bound per-origin blocked-count memory growth for long sessions. */
const MAX_TRACKED_ORIGINS = 500;

const getFiltersDir = (): string =>
  path.join(app.getAppPath(), "dist-electron", "filters");

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

export const originFromUrl = (raw: string): string | null => {
  if (!raw) {
    return null;
  }
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
};

const incrementBlockedCount = (origin: string): void => {
  if (
    !perOriginCounts.has(origin) &&
    perOriginCounts.size >= MAX_TRACKED_ORIGINS
  ) {
    const oldest = perOriginCounts.keys().next().value;
    if (oldest !== undefined) {
      perOriginCounts.delete(oldest);
    }
  }
  perOriginCounts.set(origin, (perOriginCounts.get(origin) ?? 0) + 1);
};

const loadBundledLists = async (): Promise<{ name: string; raw: string }[]> => {
  const results = await Promise.all(
    FILTER_LISTS.map(async (list) => {
      try {
        const filePath = path.join(getFiltersDir(), list.file);
        const raw = await fs.readFile(filePath, "utf-8");
        return { name: list.name, raw };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is { name: string; raw: string } => r !== null);
};

/** Content fingerprint so bundled list updates invalidate the selfie cache. */
const fingerprintLists = (lists: { name: string; raw: string }[]): string => {
  const hash = crypto.createHash("sha256");
  for (const list of lists) {
    hash.update(list.name);
    hash.update("\0");
    hash.update(list.raw);
    hash.update("\0");
  }
  return hash.digest("hex");
};

const loadCachedSelfie = async (
  fingerprint: string
): Promise<string | null> => {
  try {
    const data = await fs.readFile(getAdBlockCacheFilePath(), "utf-8");
    const parsed: unknown = JSON.parse(data);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      "fingerprint" in parsed &&
      "selfie" in parsed &&
      parsed.version === CACHE_VERSION &&
      parsed.fingerprint === fingerprint &&
      typeof parsed.selfie === "string"
    ) {
      return parsed.selfie;
    }
    return null;
  } catch {
    return null;
  }
};

const saveCachedSelfie = async (
  fingerprint: string,
  selfie: string
): Promise<void> => {
  try {
    await fs.writeFile(
      getAdBlockCacheFilePath(),
      JSON.stringify({ fingerprint, selfie, version: CACHE_VERSION }),
      "utf-8"
    );
  } catch {
    // non-critical
  }
};

export const AdBlockerLive = Layer.succeed(AdBlocker, {
  getBlockedCountForOrigin: (origin) =>
    Effect.sync(() => perOriginCounts.get(origin) ?? 0),

  init: Effect.tryPromise({
    catch: () => new Error("Failed to initialize ad blocker"),
    try: async () => {
      const lists = await loadBundledLists();
      if (lists.length === 0) {
        return;
      }

      const fingerprint = fingerprintLists(lists);
      const { StaticNetFilteringEngine } = await import("@gorhill/ubo-core");
      snfe = await StaticNetFilteringEngine.create();

      const cached = await loadCachedSelfie(fingerprint);
      if (cached) {
        await snfe.deserialize(cached);
        return;
      }

      await snfe.useLists(lists);
      const selfie = await snfe.serialize();
      await saveCachedSelfie(fingerprint, selfie);
    },
  }),

  matchRequest: (details) =>
    Effect.sync(() => {
      if (!snfe) {
        return false;
      }
      const mappedType = TYPE_MAP[details.type] ?? details.type;
      const blocked =
        snfe.matchRequest({
          method: details.method,
          originURL: details.originURL,
          type: mappedType,
          url: details.url,
        }) !== 0;
      if (blocked) {
        // originURL is "" for main-frame loads — never let URL parsing
        // flip a block decision into an allow.
        const origin = originFromUrl(details.originURL);
        if (origin) {
          incrementBlockedCount(origin);
        }
      }
      return blocked;
    }),

  resetBlockedCountForOrigin: (origin) =>
    Effect.sync(() => {
      perOriginCounts.delete(origin);
    }),
});

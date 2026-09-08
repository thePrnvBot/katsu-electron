import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
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

const TYPE_MAP = new Map([
  ["cspReport", "csp_report"],
  ["mainFrame", "main_frame"],
  ["subFrame", "sub_frame"],
  ["webSocket", "websocket"],
  ["xhr", "xmlhttprequest"],
]);

/**
 * Bumped when the cache shape changes. Content changes to the bundled
 * filter lists are caught by the content fingerprint instead.
 */
const CACHE_VERSION = 2;

const CachedSelfieSchema = Schema.Struct({
  fingerprint: Schema.String,
  selfie: Schema.String,
  version: Schema.Literal(CACHE_VERSION),
});

/** Bound per-origin blocked-count memory growth for long sessions. */
const MAX_TRACKED_ORIGINS = 500;

const getFiltersDir = (): string =>
  path.join(app.getAppPath(), "dist-electron", "filters");

export class AdBlockerError extends Data.TaggedError("AdBlockerError")<{
  readonly reason: "InitFailed";
  readonly cause: unknown;
}> {}

/** The subset of the uBO core engine the blocker uses. */
interface FilterEngine {
  matchRequest: (details: {
    originURL: string;
    url: string;
    type: string;
    method: string;
  }) => number;
  serialize: () => Promise<string>;
  deserialize: (selfie: string) => Promise<void>;
  useLists: (lists: { name: string; raw: string }[]) => Promise<void>;
}

export interface AdBlocker {
  /**
   * Load the filter engine (bundled lists + selfie cache). Single-flight:
   * every caller awaits the same load, and a failed load stays failed.
   */
  readonly init: Effect.Effect<void, AdBlockerError>;
  /**
   * Fail-open until `init` completes — a request must never be held hostage
   * by (or break because of) the blocker.
   */
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
    const cache = Schema.decodeUnknownSync(CachedSelfieSchema)(parsed);
    if (cache.fingerprint === fingerprint) {
      return cache.selfie;
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

export const AdBlockerLive = Layer.effect(
  AdBlocker,
  Effect.gen(function* makeAdBlocker() {
    const perOriginCounts = new Map<string, number>();
    let engine: FilterEngine | null = null;

    // Single-flight init: the first caller runs the load, everyone else
    // awaits the same Deferred (success or failure).
    const ready = yield* Deferred.make<null, AdBlockerError>();
    let initStarted = false;

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

    const loadEngine = (
      lists: { name: string; raw: string }[]
    ): Effect.Effect<void, AdBlockerError> =>
      Effect.gen(function* runLoad() {
        const fingerprint = fingerprintLists(lists);
        const { StaticNetFilteringEngine } = yield* Effect.tryPromise({
          catch: (cause) => new AdBlockerError({ cause, reason: "InitFailed" }),
          try: () => import("@gorhill/ubo-core"),
        });

        const snfe: FilterEngine = yield* Effect.tryPromise({
          catch: (cause) => new AdBlockerError({ cause, reason: "InitFailed" }),
          try: async () => {
            const created = await StaticNetFilteringEngine.create();
            const cached = await loadCachedSelfie(fingerprint);
            if (cached) {
              await created.deserialize(cached);
            } else {
              await created.useLists(lists);
              await saveCachedSelfie(fingerprint, await created.serialize());
            }
            return created;
          },
        });

        engine = snfe;
      });

    const init: Effect.Effect<void, AdBlockerError> = Effect.suspend(() => {
      if (initStarted) {
        return Effect.asVoid(Deferred.await(ready));
      }
      initStarted = true;
      return Effect.gen(function* runInit() {
        const lists = yield* Effect.promise(() => loadBundledLists());
        if (lists.length === 0) {
          // Usually a packaging error (missing filter copy step) — say so.
          console.warn(
            "katsu: no bundled filter lists found, ad blocker disabled"
          );
          yield* Deferred.succeed(ready, null);
          return;
        }
        yield* loadEngine(lists).pipe(
          Effect.catchAll((error) =>
            Effect.zipRight(Deferred.fail(ready, error), Effect.fail(error))
          )
        );
        yield* Deferred.succeed(ready, null);
      });
    });

    const matchRequest: AdBlocker["matchRequest"] = (details) =>
      Effect.sync(() => {
        if (!engine) {
          return false;
        }
        const mappedType = TYPE_MAP.get(details.type) ?? details.type;
        const blocked =
          engine.matchRequest({
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
      });

    return {
      getBlockedCountForOrigin: (origin) =>
        Effect.sync(() => perOriginCounts.get(origin) ?? 0),
      init,
      matchRequest,
      resetBlockedCountForOrigin: (origin) =>
        Effect.sync(() => {
          perOriginCounts.delete(origin);
        }),
    };
  })
);

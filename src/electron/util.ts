import fs from "node:fs/promises";
import path from "node:path";

import * as Effect from "effect/Effect";
import { app } from "electron";

export const isDev = (): boolean => process.env.NODE_ENV === "development";

const getUserData = (userDataFile: string): string =>
  path.join(app.getPath("userData"), userDataFile);

/** Lazily resolved — `app.getPath` must not run at module import time. */
export const getStateFilePath = (): string => getUserData("windows.json");

export const getSettingsFilePath = (): string => getUserData("settings.json");

export const getAdBlockCacheFilePath = (): string =>
  getUserData("adblock-cache.json");

/**
 * Only directory the `katsu://` protocol is allowed to serve from.
 * Holds renderer-dropped/staged preview files.
 */
export const getDropsDir = (): string =>
  path.join(app.getPath("temp"), "katsu-drops");

const TEMP_NAME_ALLOWLIST = /[^A-Za-z0-9._-]/gu;

/** Strip directory components and hostile characters from a drop filename. */
export const sanitizeTempFileName = (name: string): string => {
  const base = path.basename(name).replace(TEMP_NAME_ALLOWLIST, "_");
  return base.length > 0 ? base : "file";
};

/**
 * True when `candidate` resolves inside `dir` (rejects `..` traversal).
 */
export const isPathInside = (dir: string, candidate: string): boolean => {
  const relative = path.relative(dir, candidate);
  return (
    relative.length > 0 &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  );
};

/** Wipe stale preview drops from a previous run. Failures are non-fatal. */
export const cleanDropsDir = (): Effect.Effect<void> =>
  Effect.tryPromise({
    catch: () => new Error("failed to clean drops dir"),
    try: async () => {
      const dir = getDropsDir();
      await fs.rm(dir, { force: true, recursive: true });
      await fs.mkdir(dir, { recursive: true });
    },
  }).pipe(Effect.ignore);

export const writeFileAtomic = <E>(
  filePath: string,
  content: string,
  errorFactory: {
    rename: (err: unknown) => E;
    write: (err: unknown) => E;
  }
): Effect.Effect<void, E> =>
  Effect.gen(function* writeFileAtomicGen() {
    const tmpPath = `${filePath}.tmp`;
    yield* Effect.tryPromise({
      catch: errorFactory.write,
      try: () => fs.writeFile(tmpPath, content, "utf-8"),
    });
    yield* Effect.tryPromise({
      catch: errorFactory.rename,
      try: () => fs.rename(tmpPath, filePath),
    });
  });

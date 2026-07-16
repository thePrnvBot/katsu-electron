import fs from "node:fs/promises";
import path from "node:path";

import * as Effect from "effect/Effect";
import { app } from "electron";

export const isDev = (): boolean => process.env.NODE_ENV === "development";

export const getUserData = (userDataFile: string): string =>
  path.join(app.getPath("userData"), userDataFile);

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

/** Copies bundled uBlock filter lists into dist-electron for dev runs and packaged builds. */

import fs from "node:fs/promises";
import path from "node:path";

/**
 * Copies the bundled ad-block filter lists into `dist-electron/filters` so
 * they ship with both dev runs and packaged builds (the ad blocker reads
 * them relative to `app.getAppPath()`/`dist-electron`). Without this step a
 * packaged app silently starts with the ad blocker disabled.
 */
const root = path.resolve(import.meta.dirname, "..");
const srcDir = path.join(root, "src", "electron", "filters");
const destDir = path.join(root, "dist-electron", "filters");

await fs.mkdir(destDir, { recursive: true });
const entries = await fs.readdir(srcDir);
await Promise.all(
  entries.map((entry) =>
    fs.copyFile(path.join(srcDir, entry), path.join(destDir, entry))
  )
);
console.log(`Copied ${entries.length} filter list(s) to ${destDir}`);

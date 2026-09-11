/** Blocks until the Vite dev server responds, then Electron launches against it. */

import { setTimeout as delay } from "node:timers/promises";

const url = process.argv[2] ?? "http://localhost:5123";
const timeoutMs = 30_000;
const retryDelayMs = 100;
const deadline = Date.now() + timeoutMs;

const waitForServer = async () => {
  if (Date.now() >= deadline) {
    return false;
  }

  try {
    const response = await fetch(url);
    if (response.ok) {
      return true;
    }
  } catch {
    // The dev server may not be listening yet.
  }
  await delay(retryDelayMs);
  return waitForServer();
};

if (!(await waitForServer())) {
  console.error(`Timed out waiting for ${url}`);
  process.exitCode = 1;
}

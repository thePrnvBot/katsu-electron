/** Vitest config: collect only source tests, skipping built artifacts. */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only source tests; dist directories hold stale compiled artifacts.
    include: ["src/**/*.test.ts"],
  },
});

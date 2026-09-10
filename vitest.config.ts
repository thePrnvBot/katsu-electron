import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only source tests; dist directories hold stale compiled artifacts.
    include: ["src/**/*.test.ts"],
  },
});

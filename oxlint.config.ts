import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react],
  ignorePatterns: core.ignorePatterns,
  overrides: [
    {
      files: ["src/electron/main.ts", "src/electron/session/setup.ts"],
      rules: {
        "promise/no-callback-in-promise": "off",
        "promise/prefer-await-to-callbacks": "off",
        "promise/prefer-await-to-then": "off",
      },
    },
  ],
});

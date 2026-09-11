/** Formatter configuration delegating to Ultracite's oxfmt preset. */

import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
});

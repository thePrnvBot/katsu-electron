import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: katsu:",
  "media-src 'self' blob: katsu:",
  "font-src 'self' data:",
  "connect-src 'self' blob: katsu:",
  "frame-src blob: katsu:",
  "object-src 'none'",
  "base-uri 'none'",
].join("; ");

const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: katsu:",
  "media-src 'self' blob: katsu:",
  "font-src 'self' data:",
  "connect-src 'self' ws: blob: katsu:",
  "frame-src blob: katsu:",
  "object-src 'none'",
  "base-uri 'none'",
].join("; ");

/**
 * Injects a Content-Security-Policy meta tag into index.html.
 * Dev mode relaxes script-src/connect-src for Vite HMR + React refresh.
 */
const cspPlugin = (mode: string): Plugin => ({
  name: "katsu-csp",
  transformIndexHtml: () => [
    {
      attrs: {
        content: mode === "development" ? DEV_CSP : PROD_CSP,
        "http-equiv": "Content-Security-Policy",
      },
      injectTo: "head-prepend",
      tag: "meta",
    },
  ],
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  build: {
    outDir: "dist-react",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV ?? "development"
    ),
  },
  plugins: [react(), tailwindcss(), cspPlugin(mode)],
  server: {
    port: 5123,
    strictPort: true,
  },
}));

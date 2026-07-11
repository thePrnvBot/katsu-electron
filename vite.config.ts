import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist-react",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV ?? "development"
    ),
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5123,
    strictPort: true,
  },
});

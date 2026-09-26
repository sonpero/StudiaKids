import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // docs/modules/mascot.md: imported directly, never through
      // @studiakids/core's index (which pulls Node-only modules).
      "@studiakids/mascot": path.resolve(import.meta.dirname, "../../packages/core/src/mascot/index.ts"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        // changeOrigin would rewrite the Host header the API sees to the
        // proxy target (localhost:3000), while the browser's real Origin
        // header (localhost:5173) passes through unchanged — once auth
        // lands (M1), the API's Origin-vs-Host CSRF check would then see a
        // mismatch on every request in dev. Production has no such proxy:
        // API and web share one origin there regardless.
        changeOrigin: false,
      },
    },
  },
});

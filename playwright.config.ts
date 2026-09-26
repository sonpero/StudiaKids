import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, E2E_DATA_DIR, E2E_PORT, SESSION_SECRET, STORAGE_STATE_PATH } from "./e2e/support/env.js";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  globalSetup: "./e2e/support/global-setup.ts",
  globalTeardown: "./e2e/support/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  // Against a real build, not the Vite dev server: the built SPA served by
  // the API from one origin, matching production — the dev server's /api
  // proxy exists so local `pnpm dev` works (vite.config.ts), but running
  // e2e through it would mean the browser's real Origin header (the Vite
  // dev port) never matches Host (the proxy target), tripping the
  // Origin-vs-Host check on every mutating request (plugins/auth.ts).
  webServer: {
    command: "pnpm --filter @studiakids/web run build && pnpm --filter @studiakids/api run start",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      PORT: String(E2E_PORT),
      RAILWAY_VOLUME_MOUNT_PATH: E2E_DATA_DIR,
      SESSION_SECRET,
      COOKIE_SECURE: "false",
    },
  },
  // Every e2e test starts authenticated via the storageState saved in
  // global setup, except e2e/login.spec.ts which explicitly overrides it to
  // a blank state: the login flow itself must be exercised for real.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE_PATH },
    },
    // Decided at M2: phone emulation on the same Chromium (no other browser
    // to download), for the scenarios tagged @mobile — at least the full
    // photo journey and the capture screen.
    {
      name: "mobile",
      grep: /@mobile/,
      use: { ...devices["Pixel 7"], storageState: STORAGE_STATE_PATH },
    },
  ],
});

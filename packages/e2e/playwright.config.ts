import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(e2eDir, "../..");
// Always pin to the in-repo cache. Cursor's agent sandbox pre-sets
// PLAYWRIGHT_BROWSERS_PATH to a wiped temp dir; do not inherit that.
process.env.PLAYWRIGHT_BROWSERS_PATH = join(e2eDir, ".playwright-browsers");
config({ path: join(rootDir, ".env.e2e") });
config({ path: join(rootDir, ".env.e2e.example") });

const gmPassword = process.env.GM_PASSWORD ?? "e2e-gm";
const playerPassword = process.env.PLAYER_PASSWORD ?? "e2e-player";
const authSecret = process.env.AUTH_SECRET ?? "e2e-secret";
// Dedicated ports so e2e can run alongside `npm run dev:cf` (Vite :5173, wrangler :8787)
// or `npm run dev` (Vite :5173, Express :3001).
const clientUrl = process.env.E2E_CLIENT_URL ?? "http://localhost:5174";
const clientPort = new URL(clientUrl).port || "5174";
const apiPort = process.env.PORT ?? "3002";
const apiBaseUrl = process.env.E2E_API_URL ?? `http://localhost:${apiPort}`;
const wsUrl = process.env.E2E_WS_URL ?? `ws://localhost:${apiPort}/ws`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: clientUrl,
    headless: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
          : {}),
      },
    },
  ],

  webServer: {
    // ensure-shared-built skips tsc --force when dist is fresh so e2e does not
    // race `dev:cf`'s shared watch writing the same packages/shared/dist/.
    command: `node packages/e2e/scripts/ensure-shared-built.mjs && concurrently -n server,client -c blue,green "npm run dev -w @vtt-core/server" "VITE_API_BASE=${apiBaseUrl} VITE_WS_URL=${wsUrl} npm run dev -w @vtt-core/client -- --port ${clientPort} --strictPort"`,
    cwd: rootDir,
    url: clientUrl,
    // Dedicated e2e ports — never reuse a leftover Vite/Express from a prior run.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      GM_PASSWORD: gmPassword,
      PLAYER_PASSWORD: playerPassword,
      AUTH_SECRET: authSecret,
      PORT: apiPort,
      E2E_CLIENT_URL: clientUrl,
      E2E_API_URL: apiBaseUrl,
    },
  },
});

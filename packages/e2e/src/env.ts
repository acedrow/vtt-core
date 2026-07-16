import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: join(rootDir, ".env.e2e") });
config({ path: join(rootDir, ".env.e2e.example") });

export const E2E_ENV = {
  gmPassword: process.env.GM_PASSWORD ?? "e2e-gm",
  playerPassword: process.env.PLAYER_PASSWORD ?? "e2e-player",
  authSecret: process.env.AUTH_SECRET ?? "e2e-secret",
  // Match playwright.config.ts defaults — keep off :5173 / :3001 used by local dev.
  clientBaseUrl: process.env.E2E_CLIENT_URL ?? "http://localhost:5174",
  apiBaseUrl: process.env.E2E_API_URL ?? "http://localhost:3002",
};

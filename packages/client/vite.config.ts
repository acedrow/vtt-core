import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// When VITE_CF_DEV is set (npm run dev:cf), the client talks to the wrangler
// worker on :8787 via same-origin paths so it matches production. Vite proxies
// API/WS to wrangler; static assets are served from publicDir by Vite directly.
const cfDev = !!process.env.VITE_CF_DEV;
const workerTarget = "http://localhost:8787";
const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, "src");
const require = createRequire(import.meta.url);
const contentRoot = path.dirname(
  require.resolve("@vtt-core/hellpiercers-content/package.json"),
);
const contentSrc = path.join(contentRoot, "src");

const contentExports = [
  "@vtt-core/hellpiercers-content/register",
  "@vtt-core/hellpiercers-content/register-client",
  "@vtt-core/hellpiercers-content/tiles",
  "@vtt-core/hellpiercers-content/combat-ui",
  "@vtt-core/hellpiercers-content/combat-board-placement",
] as const;

export default defineConfig({
  plugins: [vue()],
  // Content lives in node_modules after private cutover. Prebundling it
  // duplicates @vtt-core/client/content-pack so register-client never hits the
  // app's registry ("Client content pack is not registered").
  optimizeDeps: {
    exclude: [...contentExports],
  },
  resolve: {
    alias: [
      {
        find: "@vtt-core/hellpiercers-content/register",
        replacement: path.join(contentSrc, "register.ts"),
      },
      {
        find: "@vtt-core/hellpiercers-content/register-client",
        replacement: path.join(contentSrc, "register-client.ts"),
      },
      {
        find: "@vtt-core/hellpiercers-content/tiles",
        replacement: path.join(contentSrc, "client/tiles/index.ts"),
      },
      {
        find: "@vtt-core/hellpiercers-content/combat-ui",
        replacement: path.join(contentSrc, "combat-ui.ts"),
      },
      {
        find: "@vtt-core/hellpiercers-content/combat-board-placement",
        replacement: path.join(contentSrc, "client/combat-board-placement.ts"),
      },
      {
        find: "@vtt-core/client/content-pack",
        replacement: path.join(clientSrc, "client-content-pack.ts"),
      },
      {
        find: /^@vtt-core\/client\/(.+)/,
        replacement: path.join(clientSrc, "$1"),
      },
    ],
  },
  server: {
    port: 5173,
    fs: {
      // file: sibling checkouts resolve outside packages/client
      allow: [here, contentRoot],
    },
    proxy: cfDev
      ? {
          "/api": { target: workerTarget, changeOrigin: true },
          "/ws": { target: workerTarget, changeOrigin: true, ws: true },
        }
      : undefined,
  },
});

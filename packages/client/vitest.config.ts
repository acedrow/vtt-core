import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, "src");
const require = createRequire(import.meta.url);
const contentRoot = path.dirname(
  require.resolve("@vtt-core/hellpiercers-content/package.json"),
);
const contentSrc = path.join(contentRoot, "src");

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    exclude: [
      "@vtt-core/hellpiercers-content/register",
      "@vtt-core/hellpiercers-content/register-client",
      "@vtt-core/hellpiercers-content/tiles",
      "@vtt-core/hellpiercers-content/combat-ui",
      "@vtt-core/hellpiercers-content/combat-board-placement",
    ],
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
    fs: {
      // file: sibling checkouts resolve outside packages/client
      allow: [here, contentRoot],
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
  },
});

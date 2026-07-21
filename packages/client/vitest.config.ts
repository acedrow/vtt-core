import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, "src");
const require = createRequire(import.meta.url);
const contentSrc = path.join(
  path.dirname(require.resolve("@gaem/hellpiercers-content/package.json")),
  "src",
);

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    exclude: [
      "@gaem/hellpiercers-content/register",
      "@gaem/hellpiercers-content/register-client",
      "@gaem/hellpiercers-content/tiles",
      "@gaem/hellpiercers-content/combat-ui",
      "@gaem/hellpiercers-content/combat-board-placement",
    ],
  },
  resolve: {
    alias: [
      {
        find: "@gaem/hellpiercers-content/register",
        replacement: path.join(contentSrc, "register.ts"),
      },
      {
        find: "@gaem/hellpiercers-content/register-client",
        replacement: path.join(contentSrc, "register-client.ts"),
      },
      {
        find: "@gaem/hellpiercers-content/tiles",
        replacement: path.join(contentSrc, "client/tiles/index.ts"),
      },
      {
        find: "@gaem/hellpiercers-content/combat-ui",
        replacement: path.join(contentSrc, "combat-ui.ts"),
      },
      {
        find: "@gaem/hellpiercers-content/combat-board-placement",
        replacement: path.join(contentSrc, "client/combat-board-placement.ts"),
      },
      {
        find: "@gaem/client/content-pack",
        replacement: path.join(clientSrc, "client-content-pack.ts"),
      },
      {
        find: /^@gaem\/client\/(.+)/,
        replacement: path.join(clientSrc, "$1"),
      },
    ],
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
  },
});

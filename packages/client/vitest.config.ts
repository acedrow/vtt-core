import path from "node:path";
import { fileURLToPath } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, "src");
const contentSrc = path.resolve(here, "../hellpiercers-content/src");

export default defineConfig({
  plugins: [vue()],
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

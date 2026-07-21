import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // One shared module graph for registerContentPack Maps.
      "@vtt-core/shared": path.join(here, "src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup-content-pack.ts"],
  },
});


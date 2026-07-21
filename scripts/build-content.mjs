#!/usr/bin/env node
// Build installed @vtt-core/hellpiercers-content with the engine's TypeScript.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { contentPackageRoot } from "./content-package-root.mjs";

const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
const contentRoot = contentPackageRoot();
const result = spawnSync(
  process.execPath,
  [tsc, "-b", join(contentRoot, "tsconfig.json"), "--force"],
  { cwd: contentRoot, stdio: "inherit" },
);
process.exit(result.status ?? 1);

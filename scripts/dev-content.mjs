#!/usr/bin/env node
// Watch-build installed @gaem/hellpiercers-content with the engine's TypeScript.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { contentPackageRoot } from "./content-package-root.mjs";

const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
const contentRoot = contentPackageRoot();
const child = spawn(
  process.execPath,
  [tsc, "-p", join(contentRoot, "tsconfig.json"), "--watch"],
  { cwd: contentRoot, stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 1));

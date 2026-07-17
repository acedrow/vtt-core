#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { contentPackageRoot } from "./content-package-root.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const python = join(contentPackageRoot(), "rulebook", ".venv", "bin", "python");
const script = join(rootDir, "scripts", "crop-enemy-portraits.py");
const defaultDir = join(contentPackageRoot(), "assets", "enemies");
const args = process.argv.slice(2);
const result = spawnSync(
  python,
  [script, ...(args.length > 0 ? args : [defaultDir])],
  {
    stdio: "inherit",
    cwd: rootDir,
  }
);
process.exit(result.status ?? 1);

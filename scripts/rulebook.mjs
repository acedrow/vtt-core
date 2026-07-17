#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { contentPackageRoot } from "./content-package-root.mjs";

const contentRoot = contentPackageRoot();
const python = join(contentRoot, "rulebook", ".venv", "bin", "python");
const extract = join(contentRoot, "rulebook", "extract.py");
const result = spawnSync(python, [extract, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);

#!/usr/bin/env node
// Resolve the installed @vtt-core/hellpiercers-content package root (workspace
// symlink or private git/file install under node_modules).
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export function contentPackageRoot() {
  return dirname(require.resolve("@vtt-core/hellpiercers-content/package.json"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(`${contentPackageRoot()}\n`);
}

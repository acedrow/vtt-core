#!/usr/bin/env node
// Sync content-package assets into client public/ via package root resolution.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { contentPackageRoot } from "../../../scripts/content-package-root.mjs";

const kind = process.argv[2];
if (kind !== "enemies" && kind !== "tiles") {
  console.error("Usage: sync-content-assets.mjs <enemies|tiles>");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const src = join(contentPackageRoot(), "assets", kind);
const dest = join(here, "..", "public", kind);
const syncDir = join(here, "sync-dir.mjs");

const result = spawnSync(process.execPath, [syncDir, src, dest], { stdio: "inherit" });
process.exit(result.status ?? 1);

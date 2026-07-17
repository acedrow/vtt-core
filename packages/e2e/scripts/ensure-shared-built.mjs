#!/usr/bin/env node
// Rebuild @gaem/shared (+ content) only when dist is missing or older than src.
// Avoids racing `tsc --watch` under `dev:cf` when e2e starts its stack.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { contentPackageRoot } from "../../../scripts/content-package-root.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function newestMtimeMs(dir) {
  let newest = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) {
      newest = Math.max(newest, newestMtimeMs(path));
    } else {
      newest = Math.max(newest, statSync(path).mtimeMs);
    }
  }
  return newest;
}

function needsBuild(pkgDir, distEntry) {
  const srcDir = join(pkgDir, "src");
  return !existsSync(distEntry) || newestMtimeMs(srcDir) > statSync(distEntry).mtimeMs;
}

const sharedDir = join(rootDir, "packages/shared");
const contentDir = contentPackageRoot();
const sharedNeeds = needsBuild(sharedDir, join(sharedDir, "dist/index.js"));
const contentNeeds = needsBuild(contentDir, join(contentDir, "dist/register.js"));

if (!sharedNeeds && !contentNeeds) {
  console.log("[e2e] @gaem/shared + content dist up to date — skipping rebuild");
  process.exit(0);
}

if (sharedNeeds) {
  console.log("[e2e] building @gaem/shared…");
  const result = spawnSync("npm", ["run", "build", "-w", "@gaem/shared"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

if (contentNeeds || sharedNeeds) {
  console.log("[e2e] building @gaem/hellpiercers-content…");
  const result = spawnSync("npm", ["run", "build:content"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(result.status ?? 1);
}

process.exit(0);

#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { contentPackageRoot } from "../../../scripts/content-package-root.mjs";

const cfWorkerRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const mapsDir = join(contentPackageRoot(), "maps");
const local = process.argv.includes("--local");

async function main() {
  const files = (await readdir(mapsDir)).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.error("No map JSON files found in", mapsDir);
    process.exit(1);
  }

  for (const file of files) {
    const id = basename(file, ".json");
    const path = join(mapsDir, file);
    const key = `map:${id}`;
    const args = ["kv", "key", "put", key, `--path=${path}`, "--binding=MAP_KV"];
    if (local) {
      args.push("--local", "--preview");
    } else {
      args.push("--remote", "--preview", "false");
    }

    console.log(`Syncing ${file} -> ${key}${local ? " (local)" : ""}`);
    const result = spawnSync("npx", ["wrangler", ...args], {
      cwd: cfWorkerRoot,
      stdio: "inherit",
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

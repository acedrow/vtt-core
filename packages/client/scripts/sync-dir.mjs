#!/usr/bin/env node
// Mirror src -> dest like `rsync -a --delete`, without requiring rsync
// (Cloudflare Workers Builds has no rsync). Skips unchanged files and avoids
// wiping the destination root so Vite HMR does not thrash during concurrent
// predev/prebuild while `dev:cf` is up.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
} from "node:fs";
import { join } from "node:path";

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error("Usage: sync-dir.mjs <srcDir> <destDir>");
  process.exit(1);
}

function syncMirror(from, to) {
  mkdirSync(to, { recursive: true });
  const srcNames = new Set(readdirSync(from));
  for (const name of readdirSync(to)) {
    if (!srcNames.has(name)) {
      rmSync(join(to, name), { recursive: true, force: true });
    }
  }
  for (const name of srcNames) {
    const fromPath = join(from, name);
    const toPath = join(to, name);
    const fromStat = statSync(fromPath);
    if (fromStat.isDirectory()) {
      syncMirror(fromPath, toPath);
      continue;
    }
    if (existsSync(toPath)) {
      const toStat = statSync(toPath);
      if (
        toStat.isFile() &&
        toStat.size === fromStat.size &&
        toStat.mtimeMs === fromStat.mtimeMs
      ) {
        continue;
      }
    }
    copyFileSync(fromPath, toPath);
    utimesSync(toPath, fromStat.atime, fromStat.mtime);
  }
}

if (!existsSync(src)) {
  console.error(`sync-dir: source not found: ${src}`);
  process.exit(1);
}

syncMirror(src, dest);

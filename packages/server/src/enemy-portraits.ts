import { readdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { Request, Response } from "express";

const SET_SLUG_RE = /^[a-z0-9-]+$/;

const require = createRequire(import.meta.url);
const enemiesRoot = join(
  dirname(require.resolve("@vtt-core/hellpiercers-content/package.json")),
  "assets/enemies"
);

export const enemyPortraits = new Map<string, { body: Buffer; contentType: string }>();

export async function loadEnemyPortraits(): Promise<void> {
  enemyPortraits.clear();
  let setDirs: string[];
  try {
    setDirs = await readdir(enemiesRoot);
  } catch {
    return;
  }
  for (const set of setDirs) {
    if (!SET_SLUG_RE.test(set)) continue;
    const setDir = join(enemiesRoot, set);
    let setStat;
    try {
      setStat = await stat(setDir);
    } catch {
      continue;
    }
    if (!setStat.isDirectory()) continue;
    let files: string[];
    try {
      files = await readdir(setDir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith(".png")) continue;
      const slug = file.replace(/\.png$/, "");
      if (!SET_SLUG_RE.test(slug)) continue;
      const body = await readFile(join(setDir, file));
      enemyPortraits.set(`${set}/${slug}`, { body, contentType: "image/png" });
    }
  }
}

export function getEnemyPortraitHandler(req: Request, res: Response): void {
  const rawSet = req.params.set;
  const rawSlug = req.params.slug;
  const set = typeof rawSet === "string" ? rawSet : rawSet[0];
  const slug = typeof rawSlug === "string" ? rawSlug : rawSlug[0];
  if (!set || !slug || !SET_SLUG_RE.test(set) || !SET_SLUG_RE.test(slug)) {
    res.status(400).json({ error: "Invalid portrait set or slug" });
    return;
  }

  const portrait = enemyPortraits.get(`${set}/${slug}`);
  if (!portrait) {
    res.status(404).json({ error: "Portrait not found" });
    return;
  }

  res.setHeader("Content-Type", portrait.contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(portrait.body);
}

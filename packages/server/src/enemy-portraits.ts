import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Request, Response } from "express";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const portraitsDir = join(root, "assets/enemies/paracletus");

export const enemyPortraits = new Map<string, { body: Buffer; contentType: string }>();

export async function loadEnemyPortraits(): Promise<void> {
  enemyPortraits.clear();
  let files: string[];
  try {
    files = await readdir(portraitsDir);
  } catch {
    return;
  }
  for (const file of files) {
    if (!file.endsWith(".png")) continue;
    const slug = file.replace(/\.png$/, "");
    const body = await readFile(join(portraitsDir, file));
    enemyPortraits.set(slug, { body, contentType: "image/png" });
  }
}

export function getEnemyPortraitHandler(req: Request, res: Response): void {
  const raw = req.params.slug;
  const slug = typeof raw === "string" ? raw : raw[0];
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    res.status(400).json({ error: "Invalid portrait slug" });
    return;
  }

  const portrait = enemyPortraits.get(slug);
  if (!portrait) {
    res.status(404).json({ error: "Portrait not found" });
    return;
  }

  res.setHeader("Content-Type", portrait.contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(portrait.body);
}

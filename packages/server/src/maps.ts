import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { GameMap, GameMapSummary } from "@gaem/shared";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createBlankGameMap,
  parseGameMap,
  toMapSummary,
} from "@gaem/shared";
import type { Request, Response } from "express";

import type { AuthContext } from "./auth.js";
import { authHasGmCapabilities } from "./auth.js";

const MAP_ID_RE = /^[a-z0-9-]+$/;

export const savedMaps = new Map<string, GameMap>();

export async function seedMapsFromDisk(mapsDir: string): Promise<void> {
  const files = await readdir(mapsDir);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await readFile(join(mapsDir, file), "utf8");
    const map = parseGameMap(JSON.parse(raw));
    savedMaps.set(map.id, map);
  }
}

function sortedSummaries(): GameMapSummary[] {
  return [...savedMaps.values()]
    .map(toMapSummary)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listMapsHandler(auth: AuthContext, res: Response): void {
  if (!authHasGmCapabilities(auth)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json({ maps: sortedSummaries() });
}

export function getMapHandler(auth: AuthContext, mapId: string, res: Response): void {
  if (!authHasGmCapabilities(auth)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const map = savedMaps.get(mapId);
  if (!map) {
    res.status(404).json({ error: "Map not found" });
    return;
  }
  res.json({ map });
}

export function createMapHandler(auth: AuthContext, req: Request, res: Response): void {
  if (!authHasGmCapabilities(auth)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const id = typeof req.body?.id === "string" ? req.body.id.trim() : "";
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const widthRaw = req.body?.width;
  const heightRaw = req.body?.height;

  if (!id || !name) {
    res.status(400).json({ error: "id and name are required" });
    return;
  }
  if (!MAP_ID_RE.test(id)) {
    res.status(400).json({ error: "id must be lowercase letters, numbers, and hyphens only" });
    return;
  }
  if (savedMaps.has(id)) {
    res.status(409).json({ error: "Map id already exists" });
    return;
  }

  const width =
    Number.isInteger(widthRaw) && (widthRaw as number) > 0
      ? (widthRaw as number)
      : BOARD_WIDTH;
  const height =
    Number.isInteger(heightRaw) && (heightRaw as number) > 0
      ? (heightRaw as number)
      : BOARD_HEIGHT;

  const map = createBlankGameMap(id, name, width, height);
  savedMaps.set(id, map);
  res.status(201).json({ map: toMapSummary(map) });
}

export function deleteMapHandler(
  auth: AuthContext,
  mapId: string,
  activeMapId: string,
  res: Response,
): void {
  if (!authHasGmCapabilities(auth)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!savedMaps.has(mapId)) {
    res.status(404).json({ error: "Map not found" });
    return;
  }
  if (mapId === activeMapId) {
    res.status(400).json({ error: "Cannot delete the active map" });
    return;
  }
  if (savedMaps.size <= 1) {
    res.status(400).json({ error: "Cannot delete the last map" });
    return;
  }
  savedMaps.delete(mapId);
  res.status(204).end();
}

export function mapsDirPath(): string {
  return join(fileURLToPath(new URL(".", import.meta.url)), "../../hellpiercers-content/maps");
}

import type { TilePaintPreset } from "@vtt-core/shared";
import { parseTilePaintPreset } from "@vtt-core/shared";
import type { Response } from "express";

import type { AuthContext } from "./auth.js";
import { authHasGmCapabilities } from "./auth.js";

export const runtimeTilePresets = new Map<string, Record<string, TilePaintPreset>>();

export function getTilePresetsForMap(mapId: string, mapPresets?: Record<string, TilePaintPreset>): Record<string, TilePaintPreset> {
  const runtime = runtimeTilePresets.get(mapId);
  if (runtime) return { ...runtime };
  return { ...(mapPresets ?? {}) };
}

export function seedTilePresetsFromMap(mapId: string, mapPresets?: Record<string, TilePaintPreset>): void {
  if (!runtimeTilePresets.has(mapId)) {
    runtimeTilePresets.set(mapId, { ...(mapPresets ?? {}) });
  }
}

export function listTilePresetsHandler(
  auth: AuthContext,
  mapId: string,
  mapPresets: Record<string, TilePaintPreset> | undefined,
  res: Response,
): void {
  if (!authHasGmCapabilities(auth)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json({ presets: getTilePresetsForMap(mapId, mapPresets) });
}

export function putTilePresetHandler(
  auth: AuthContext,
  mapId: string,
  presetName: string,
  body: unknown,
  res: Response,
): TilePaintPreset | null {
  if (!authHasGmCapabilities(auth)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  const trimmed = presetName.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Preset name is required" });
    return null;
  }

  const presets = runtimeTilePresets.get(mapId) ?? {};
  if (presets[trimmed]) {
    res.status(409).json({ error: "Preset name already exists" });
    return null;
  }

  let preset: TilePaintPreset;
  try {
    preset = parseTilePaintPreset(body, `preset "${trimmed}"`);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid preset" });
    return null;
  }

  presets[trimmed] = preset;
  runtimeTilePresets.set(mapId, presets);
  res.json({ presets: { ...presets } });
  return preset;
}

export function deleteTilePresetHandler(
  auth: AuthContext,
  mapId: string,
  presetName: string,
  res: Response,
): boolean {
  if (!authHasGmCapabilities(auth)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }

  const trimmed = presetName.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Preset name is required" });
    return false;
  }

  const presets = runtimeTilePresets.get(mapId);
  if (!presets?.[trimmed]) {
    res.status(404).json({ error: "Not found" });
    return false;
  }

  delete presets[trimmed];
  runtimeTilePresets.set(mapId, presets);
  res.json({ presets: { ...presets } });
  return true;
}

import type { TilePaintPreset } from "@vtt-core/shared";
import { parseTilePaintPreset } from "@vtt-core/shared";

import type { AuthContext } from "./auth.js";
import { authHasGmCapabilities } from "./auth.js";
import type { Env } from "./env.js";
import { getMap, putMap } from "./maps.js";

export async function handleListTilePresets(
  env: Env,
  auth: AuthContext,
  mapId: string,
): Promise<Response> {
  if (!(await authHasGmCapabilities(auth, env))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const map = await getMap(env, mapId);
    return Response.json({ presets: map.tilePresets ?? {} });
  } catch {
    return Response.json({ error: "Map not found" }, { status: 404 });
  }
}

export async function handlePutTilePreset(
  env: Env,
  auth: AuthContext,
  mapId: string,
  presetName: string,
  request: Request,
): Promise<Response> {
  if (!(await authHasGmCapabilities(auth, env))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const trimmed = presetName.trim();
  if (!trimmed) {
    return Response.json({ error: "Preset name is required" }, { status: 400 });
  }

  let map;
  try {
    map = await getMap(env, mapId);
  } catch {
    return Response.json({ error: "Map not found" }, { status: 404 });
  }

  const presets = { ...(map.tilePresets ?? {}) };
  if (presets[trimmed]) {
    return Response.json({ error: "Preset name already exists" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  let preset: TilePaintPreset;
  try {
    preset = parseTilePaintPreset(body, `preset "${trimmed}"`);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid preset" },
      { status: 400 },
    );
  }

  presets[trimmed] = preset;
  map.tilePresets = presets;
  await putMap(env, map);
  return Response.json({ presets });
}

export async function handleDeleteTilePreset(
  env: Env,
  auth: AuthContext,
  mapId: string,
  presetName: string,
): Promise<Response> {
  if (!(await authHasGmCapabilities(auth, env))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const trimmed = presetName.trim();
  if (!trimmed) {
    return Response.json({ error: "Preset name is required" }, { status: 400 });
  }

  let map;
  try {
    map = await getMap(env, mapId);
  } catch {
    return Response.json({ error: "Map not found" }, { status: 404 });
  }

  const presets = { ...(map.tilePresets ?? {}) };
  if (!presets[trimmed]) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  delete presets[trimmed];
  map.tilePresets = Object.keys(presets).length > 0 ? presets : undefined;
  await putMap(env, map);
  return Response.json({ presets });
}

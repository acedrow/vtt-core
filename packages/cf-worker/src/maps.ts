import type { GameMap, GameMapSummary } from "@gaem/shared";
import { parseGameMap, toMapSummary } from "@gaem/shared";

import type { Env } from "./env.js";

function mapKey(id: string): string {
  return `map:${id}`;
}

export async function getMap(env: Env, id: string): Promise<GameMap> {
  const raw = await env.MAP_KV.get(mapKey(id));
  if (!raw) {
    throw new Error(`Map not found: ${id}`);
  }
  return parseGameMap(JSON.parse(raw));
}

export async function putMap(env: Env, map: GameMap): Promise<void> {
  await env.MAP_KV.put(mapKey(map.id), JSON.stringify(map));
}

export async function listMaps(env: Env): Promise<GameMapSummary[]> {
  const listing = await env.MAP_KV.list({ prefix: "map:" });
  const summaries: GameMapSummary[] = [];
  for (const key of listing.keys) {
    const raw = await env.MAP_KV.get(key.name);
    if (!raw) continue;
    summaries.push(toMapSummary(parseGameMap(JSON.parse(raw))));
  }
  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteMap(env: Env, id: string): Promise<void> {
  await env.MAP_KV.delete(mapKey(id));
}

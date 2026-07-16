import { assertContentPackRegistered } from "./content-pack-state.js";
import { TERRAIN_TYPES, type TerrainType } from "./types.js";

export type TerrainTypeEntry = {
  id: TerrainType;
  name: string;
  summary: string;
  description: string;
  icon?: string;
};

const entryById = new Map<TerrainType, TerrainTypeEntry>();
const entries: TerrainTypeEntry[] = [];

export const TERRAIN_TYPE_ENTRIES: TerrainTypeEntry[] = [];

export function replaceTerrainCatalog(terrainTypes: TerrainTypeEntry[]): void {
  entryById.clear();
  entries.length = 0;
  entries.push(...terrainTypes);
  for (const entry of entries) {
    entryById.set(entry.id, entry);
  }
  for (const id of TERRAIN_TYPES) {
    if (!entryById.has(id)) {
      throw new Error(`terrain catalog is missing entry for "${id}"`);
    }
  }
  TERRAIN_TYPE_ENTRIES.length = 0;
  TERRAIN_TYPE_ENTRIES.push(...TERRAIN_TYPES.map((id) => entryById.get(id)!));
}

export function getTerrainTypeById(id: string): TerrainTypeEntry | undefined {
  assertContentPackRegistered();
  const byId = entryById.get(id as TerrainType);
  if (byId) return byId;
  const normalized = id.toLowerCase();
  return entries.find((entry) => entry.name.toLowerCase() === normalized);
}

export function terrainTypeDisplayName(id: string): string {
  assertContentPackRegistered();
  return entryById.get(id as TerrainType)?.name ?? id;
}

export function terrainTypeIcon(id: string): string | undefined {
  assertContentPackRegistered();
  return entryById.get(id as TerrainType)?.icon;
}

export function primaryTerrainTypeForIcon(terrain: TerrainType[]): TerrainType | null {
  if (terrain.includes("void")) return "void";
  if (terrain.includes("impassable")) return "impassable";
  if (terrain.includes("obstacle")) return "obstacle";
  if (terrain.includes("cover")) return "cover";
  if (terrain.includes("uneasy")) return "uneasy";
  if (terrain.includes("advantageous")) return "advantageous";
  return null;
}

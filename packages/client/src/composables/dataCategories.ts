import { factionHasEnemyListings } from "@gaem/shared";

export type EngineDataCategory =
  | "armor"
  | "classes"
  | "weapons"
  | "equipment"
  | "gear"
  | "resources"
  | "effects"
  | "terrain"
  | "patterns";

export type DataCategory = EngineDataCategory | string;
export type DataFocusKind = DataCategory | "enemy";

export type DataFocus = {
  kind: DataFocusKind;
  name: string;
};

export const ENGINE_DATA_CATEGORIES = new Set<string>([
  "armor",
  "classes",
  "weapons",
  "equipment",
  "gear",
  "resources",
  "effects",
  "terrain",
  "patterns",
]);

export function isEnemyDataCategory(category: string): boolean {
  return factionHasEnemyListings(category);
}

export function isDataCategory(category: string): boolean {
  return ENGINE_DATA_CATEGORIES.has(category) || isEnemyDataCategory(category);
}

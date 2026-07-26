import { factionHasEnemyListings } from "@vtt-core/shared";

import { isClientDataCategoryId } from "../client-content-pack.js";

export type EngineDataCategory =
  | "armor"
  | "classes"
  | "weapons"
  | "equipment"
  | "gear"
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
  "effects",
  "terrain",
  "patterns",
]);

export function isEnemyDataCategory(category: string): boolean {
  return factionHasEnemyListings(category);
}

export function isDataCategory(category: string): boolean {
  return (
    ENGINE_DATA_CATEGORIES.has(category) ||
    isClientDataCategoryId(category) ||
    isEnemyDataCategory(category)
  );
}

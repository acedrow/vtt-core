import type { CharacterSheet } from "@gaem/shared";
import {
  abilityTextToPlain,
  listEnemyListings,
  PLAYER_ARMOR,
  PLAYER_CLASSES,
  PLAYER_EQUIPMENT,
  PLAYER_GEAR,
  PLAYER_WEAPONS,
  RULE_EFFECTS,
  TERRAIN_TYPE_ENTRIES,
} from "@gaem/shared";

import type { DataFocusKind } from "../composables/useInfoDataSelection.js";

export type GameDataSearchResultKind = DataFocusKind | "characterSheet";

export type GameDataSearchResult = {
  kind: GameDataSearchResultKind;
  name: string;
  subtitle?: string;
  score: number;
  sheetId?: string;
};

type SearchEntry = {
  kind: GameDataSearchResultKind;
  name: string;
  subtitle?: string;
  haystack: string;
  sheetId?: string;
};

function haystack(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

const PLAYER_DATA_INDEX: SearchEntry[] = [
  ...PLAYER_CLASSES.map((item) => ({
    kind: "classes" as const,
    name: item.name,
    subtitle: item.summary,
    haystack: haystack(
      item.name,
      item.summary,
      item.description,
      abilityTextToPlain(item.activeAbility),
      abilityTextToPlain(item.passiveAbility),
    ),
  })),
  ...PLAYER_ARMOR.map((item) => ({
    kind: "armor" as const,
    name: item.name,
    subtitle: item.summary,
    haystack: haystack(
      item.name,
      item.summary,
      item.description,
      abilityTextToPlain(item.specialMovement),
      abilityTextToPlain(item.armorAction),
      item.reversal?.description,
      item.reversal?.effect,
      item.reversal?.trigger,
    ),
  })),
  ...PLAYER_WEAPONS.map((item) => ({
    kind: "weapons" as const,
    name: item.name,
    haystack: haystack(
      item.name,
      item.description,
      abilityTextToPlain(item.activeAbility),
      abilityTextToPlain(item.passiveAbility),
    ),
  })),
  ...PLAYER_EQUIPMENT.map((item) => ({
    kind: "equipment" as const,
    name: item.name,
    haystack: haystack(item.name, item.description, item.effect),
  })),
  ...PLAYER_GEAR.map((item) => ({
    kind: "gear" as const,
    name: item.name,
    subtitle: item.slot === "armor" ? "Armor gear" : "Weapon gear",
    haystack: haystack(item.name, item.description, item.effect, item.slot),
  })),
  ...RULE_EFFECTS.map((item) => ({
    kind: "effects" as const,
    name: item.id,
    subtitle: item.summary,
    haystack: haystack(item.id, item.summary, item.description),
  })),
  ...TERRAIN_TYPE_ENTRIES.map((item) => ({
    kind: "terrain" as const,
    name: item.name,
    subtitle: item.summary,
    haystack: haystack(item.id, item.name, item.summary, item.description),
  })),
];

const ENEMY_INDEX: SearchEntry[] = listEnemyListings().map((item) => ({
  kind: "enemy" as const,
  name: item.name,
  subtitle: item.title,
  haystack: haystack(
    item.name,
    item.codename,
    item.title,
    item.description,
    item.tags?.join(" "),
  ),
}));

function characterSheetEntries(sheets: CharacterSheet[]): SearchEntry[] {
  return sheets.map((sheet) => ({
    kind: "characterSheet" as const,
    name: sheet.name,
    sheetId: sheet.id,
    subtitle: sheet.class,
    haystack: haystack(sheet.name, sheet.class, sheet.armor, sheet.weapon),
  }));
}

function scoreMatch(name: string, haystack: string, query: string): number {
  const normalizedName = name.toLowerCase();
  if (normalizedName === query) return 100;
  if (normalizedName.startsWith(query)) return 80;
  if (normalizedName.includes(query)) return 60;
  if (haystack.includes(query)) return 40;
  const terms = query.split(/\s+/).filter(Boolean);
  if (terms.length > 1 && terms.every((term) => haystack.includes(term))) return 30;
  return 0;
}

export type SearchGameDataOptions = {
  includeEnemies?: boolean;
  characterSheets?: CharacterSheet[];
};

export function searchGameData(
  query: string,
  options: SearchGameDataOptions = {},
  limit = 12,
): GameDataSearchResult[] {
  const { includeEnemies = true, characterSheets = [] } = options;
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const searchIndex = [
    ...PLAYER_DATA_INDEX,
    ...(includeEnemies ? ENEMY_INDEX : []),
    ...characterSheetEntries(characterSheets),
  ];

  const results: GameDataSearchResult[] = [];
  for (const entry of searchIndex) {
    const score = scoreMatch(entry.name, entry.haystack, trimmed);
    if (score > 0) {
      results.push({
        kind: entry.kind,
        name: entry.name,
        subtitle: entry.subtitle,
        score,
        sheetId: entry.sheetId,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function kindLabel(kind: GameDataSearchResultKind): string {
  if (kind === "classes") return "Class";
  if (kind === "armor") return "Armor";
  if (kind === "weapons") return "Weapon";
  if (kind === "equipment") return "Equipment";
  if (kind === "gear") return "Gear";
  if (kind === "effects") return "Effect";
  if (kind === "terrain") return "Terrain";
  if (kind === "characterSheet") return "Character sheet";
  return "Enemy";
}

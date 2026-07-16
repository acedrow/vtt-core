import {
  getPlayerDataString,
  setPlayerDataString,
  type CharacterSheetLoadoutFields,
  type Player,
} from "@gaem/shared";

export const YADATHAN_TOWER_DATA_KEY = "yadathanTower";
const YADATHAN_ARMOR_NAME = "YADATHAN";
const YADATHAN_TOWER_NAMES = new Set(["Katapty", "Kerauno", "Hermńdion", "Iatrós"]);

export function getYadathanTower(
  target: { data?: Record<string, unknown>; yadathanTower?: string } | null | undefined,
): string | undefined {
  return getPlayerDataString(
    target as { data?: Record<string, unknown> } | null | undefined,
    YADATHAN_TOWER_DATA_KEY,
  );
}

export function setYadathanTower(
  target: { data?: Record<string, unknown> },
  tower: string | undefined,
): void {
  setPlayerDataString(target, YADATHAN_TOWER_DATA_KEY, tower);
}

export function validateYadathanSheetLoadout(
  fields: CharacterSheetLoadoutFields,
  existing?: CharacterSheetLoadoutFields,
): string | null {
  const armor = fields.armor ?? existing?.armor;
  if (armor !== YADATHAN_ARMOR_NAME) {
    return null;
  }
  const tower =
    getYadathanTower(fields) ??
    getYadathanTower(existing) ??
    (typeof fields.data?.[YADATHAN_TOWER_DATA_KEY] === "string"
      ? (fields.data[YADATHAN_TOWER_DATA_KEY] as string)
      : undefined);
  if (!tower || !YADATHAN_TOWER_NAMES.has(tower)) {
    return "YADATHAN requires a tower selection";
  }
  const dataTower = fields.data?.[YADATHAN_TOWER_DATA_KEY];
  if (typeof dataTower === "string" && dataTower && !YADATHAN_TOWER_NAMES.has(dataTower)) {
    return `Invalid YADATHAN tower: ${dataTower}`;
  }
  return null;
}

export function applyYadathanSheetLoadout(
  player: Player,
  loadout: { armor: string; data?: Record<string, unknown> },
): void {
  if (loadout.armor === YADATHAN_ARMOR_NAME) {
    const tower = getYadathanTower({ data: loadout.data });
    if (tower) setYadathanTower(player, tower);
  } else {
    setYadathanTower(player, undefined);
  }
}

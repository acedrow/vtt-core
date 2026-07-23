import type { BoardActionMode, OmnistrikeStep } from "../composables/useBoardActionMode.js";
import { listClientBoardModes } from "../client-content-pack.js";

export type BoardTargetingContext = {
  omnistrikeStep?: OmnistrikeStep;
};

// Engine core modes that always route token clicks to cell targeting.
export const BOARD_CELL_TARGETING_MODES = [
  "move",
  "attack",
  "omnistrike",
  "warhook",
  "shove",
  "sprint",
  "aegis",
  "armorTeleport",
  "armorPush",
  "armorPlaceTower",
  "towerTeleport",
  "kataptyPick",
  "rez",
  "assistedLaunch",
] as const;

const targetingModes = new Set<string>(BOARD_CELL_TARGETING_MODES);

export function routesTokenClickToCellTargeting(
  mode: BoardActionMode,
  ctx: BoardTargetingContext = {},
): boolean {
  if (!mode || mode === "gmEnemyAttack") return false;
  if (mode === "omnistrike" && ctx.omnistrikeStep === "selectBombs") return false;
  if (targetingModes.has(mode)) return true;
  return listClientBoardModes().some((plugin) => plugin.id === mode);
}

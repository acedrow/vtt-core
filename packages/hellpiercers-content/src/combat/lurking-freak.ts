import type { Enemy, GameState } from "@gaem/shared";
import { enemyLabel } from "@gaem/shared";
import { stainwalkKind } from "./stainwalk.js";

export function isLurkingFreak(enemy: Pick<Enemy, "name">): boolean {
  return stainwalkKind(enemy) === "lurking-freak";
}

export function enemyBlocksTileOccupancy(enemy: Pick<Enemy, "burrowed">): boolean {
  return !enemy.burrowed;
}

export function applyLurkingFreakAgnosia(_state: GameState, enemy: Enemy): string[] {
  enemy.burrowed = true;
  return [
    `${enemyLabel(enemy)} Agnosia: burrowed (counts as Stained; other units may occupy)`,
  ];
}

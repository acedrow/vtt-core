import type { PatternDirection } from "../pattern-data.js";
import type { GameState, Player } from "../types.js";

export type WeaponActiveAction = {
  action: "pack";
  kind: "weaponActive";
  detail?: {
    detail?: string;
    targetEnemyIds?: string[];
    targetPlayerIds?: string[];
    direction?: PatternDirection;
    omnistrike?: {
      bombIndices: [number, number];
      anchors: [{ x: number; y: number }, { x: number; y: number }];
      direction: PatternDirection;
    };
    warhook?: {
      targetEnemyId?: string;
      targetX: number;
      targetY: number;
      landingX: number;
      landingY: number;
      damageRoll?: number;
      useBreaker?: boolean;
    };
  };
};

export type WeaponActiveHandler = {
  id: string;
  match: (player: Player, action: WeaponActiveAction) => boolean;
  validate: (state: GameState, player: Player, action: WeaponActiveAction) => string | null;
  apply: (state: GameState, player: Player, action: WeaponActiveAction) => string;
};

let handlers: WeaponActiveHandler[] = [];

export function replaceWeaponActiveHandlers(next: WeaponActiveHandler[]): void {
  handlers = next.slice();
}

export function clearWeaponActiveHandlers(): void {
  handlers = [];
}

export function getWeaponActiveHandlers(): WeaponActiveHandler[] {
  return handlers;
}

export function findWeaponActiveHandler(
  player: Player,
  action: WeaponActiveAction,
): WeaponActiveHandler | null {
  return handlers.find((h) => h.match(player, action)) ?? null;
}

import type { Enemy, GameState, Player } from "../types.js";
import {
  buildBoardOccupancy,
  clampHp,
  getEnemyMaxHp,
  getPlayerMaxHp,
  occupancyBlockedByEnemy,
} from "../game.js";
import { coordKey, isInBounds, isWalkable, tileAt } from "../map.js";
import { getEnemyListingByName } from "../enemy-data.js";
import { isTowerEnemy } from "./content-modules-api.js";

const ELEV_MIN = -3;
const ELEV_MAX = 3;

export type Elevatable = {
  x: number;
  y: number;
  elevation?: number;
  falling?: { peak: number };
  effects?: { Aegis?: number; Seeking?: number; Piercing?: number };
  name?: string;
  class?: string;
  hp?: number;
};

export function clampElevation(value: number): number {
  return Math.max(ELEV_MIN, Math.min(ELEV_MAX, Math.trunc(value)));
}

export function tileElevation(state: GameState, x: number, y: number): number {
  return tileAt(state.tiles, x, y)?.elevation ?? 0;
}

export function enemyHasFlyingTag(enemy: Pick<Enemy, "name">): boolean {
  return getEnemyListingByName(enemy.name)?.tags?.includes("Flying") ?? false;
}

export function isFlyingUnit(unit: Elevatable): boolean {
  if ((unit.effects?.Aegis ?? 0) > 0) return true;
  if ("class" in unit) return false;
  return enemyHasFlyingTag(unit as Enemy);
}

export function canMaintainElevation(unit: Elevatable): boolean {
  return isFlyingUnit(unit);
}

export function unitHasSeeking(unit: Elevatable): boolean {
  return (unit.effects?.Seeking ?? 0) > 0;
}

export function unitPiercingStacks(unit: Elevatable): number {
  return Math.max(0, unit.effects?.Piercing ?? 0);
}

export function baseUnitElevation(state: GameState, unit: Elevatable): number {
  if (unit.elevation != null) return clampElevation(unit.elevation);
  return tileElevation(state, unit.x, unit.y);
}

export function effectiveElevation(state: GameState, unit: Elevatable): number {
  let elev = baseUnitElevation(state, unit);
  if (isFlyingUnit(unit)) elev += 1;
  return clampElevation(elev);
}

export function elevationAtCoords(state: GameState, x: number, y: number): number {
  const occ = buildBoardOccupancy(state);
  const key = coordKey(x, y);
  const enemy = occ.enemyByKey.get(key);
  if (enemy) return effectiveElevation(state, enemy);
  const player = occ.playerByKey.get(key);
  if (player) return effectiveElevation(state, player);
  return tileElevation(state, x, y);
}

export function syncUnitElevationOnTile(
  state: GameState,
  unit: Elevatable,
  x: number,
  y: number,
): void {
  const tileElev = tileElevation(state, x, y);
  const current = unit.elevation ?? tileElevation(state, unit.x, unit.y);
  if (canMaintainElevation(unit)) {
    unit.elevation = clampElevation(Math.max(current, tileElev));
    return;
  }
  unit.elevation = clampElevation(tileElev);
}

export function initializeUnitElevation(state: GameState, unit: Elevatable): void {
  unit.elevation = clampElevation(tileElevation(state, unit.x, unit.y));
}

function dealElevDamage(unit: Elevatable, kind: "player" | "enemy", amount: number): void {
  if (amount <= 0 || unit.hp === undefined) return;
  if (kind === "player") {
    unit.hp = clampHp(unit.hp - amount, getPlayerMaxHp(unit as Player));
  } else {
    unit.hp = clampHp(unit.hp - amount, getEnemyMaxHp(unit as Enemy));
  }
}

function nearestUnoccupiedTile(
  state: GameState,
  fromX: number,
  fromY: number,
  excludePlayerId?: string,
  excludeEnemyId?: string,
): { x: number; y: number } | null {
  const occ = buildBoardOccupancy(state);
  const queue: { x: number; y: number }[] = [{ x: fromX, y: fromY }];
  const seen = new Set<string>([coordKey(fromX, fromY)]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const x = cur.x + dx!;
      const y = cur.y + dy!;
      const key = coordKey(x, y);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!isInBounds(x, y, state.width, state.height)) continue;
      if (!isWalkable(tileAt(state.tiles, x, y))) continue;
      const player = occ.playerByKey.get(key);
      if (player && player.id !== excludePlayerId) {
        queue.push({ x, y });
        continue;
      }
      const enemy = occ.enemyByKey.get(key);
      if (enemy && enemy.id !== excludeEnemyId && occupancyBlockedByEnemy(occ, x, y)) {
        queue.push({ x, y });
        continue;
      }
      return { x, y };
    }
  }
  return null;
}

function pushOccupantOffTile(
  state: GameState,
  x: number,
  y: number,
  excludePlayerId?: string,
  excludeEnemyId?: string,
): string | null {
  const occ = buildBoardOccupancy(state);
  const key = coordKey(x, y);
  const player = occ.playerByKey.get(key);
  if (player && player.id !== excludePlayerId) {
    const dest = nearestUnoccupiedTile(state, x, y, player.id, excludeEnemyId);
    if (!dest) return null;
    player.x = dest.x;
    player.y = dest.y;
    syncUnitElevationOnTile(state, player, dest.x, dest.y);
    return `pushed occupant to (${dest.x}, ${dest.y})`;
  }
  const enemy = occ.enemyByKey.get(key);
  if (
    enemy &&
    enemy.id !== excludeEnemyId &&
    !isTowerEnemy(enemy) &&
    occupancyBlockedByEnemy(occ, x, y)
  ) {
    const dest = nearestUnoccupiedTile(state, x, y, excludePlayerId, enemy.id);
    if (!dest) return null;
    enemy.x = dest.x;
    enemy.y = dest.y;
    syncUnitElevationOnTile(state, enemy, dest.x, dest.y);
    return `pushed occupant to (${dest.x}, ${dest.y})`;
  }
  return null;
}

function applyLandingCollision(
  state: GameState,
  faller: Elevatable,
  kind: "player" | "enemy",
  elevLost: number,
): string[] {
  const messages: string[] = [];
  if (elevLost <= 0) return messages;
  const occ = buildBoardOccupancy(state);
  const key = coordKey(faller.x, faller.y);
  const excludePlayerId = kind === "player" ? (faller as Player).id : undefined;
  const excludeEnemyId = kind === "enemy" ? (faller as Enemy).id : undefined;
  const player = occ.playerByKey.get(key);
  if (player && player.id !== excludePlayerId) {
    dealElevDamage(player, "player", elevLost);
    messages.push(`landing collision ${elevLost} damage to player`);
    const pushed = pushOccupantOffTile(state, faller.x, faller.y, excludePlayerId, excludeEnemyId);
    if (pushed) messages.push(pushed);
    return messages;
  }
  const enemy = occ.enemyByKey.get(key);
  if (
    enemy &&
    enemy.id !== excludeEnemyId &&
    !isTowerEnemy(enemy) &&
    occupancyBlockedByEnemy(occ, faller.x, faller.y)
  ) {
    dealElevDamage(enemy, "enemy", elevLost);
    messages.push(`landing collision ${elevLost} damage to enemy`);
    const pushed = pushOccupantOffTile(state, faller.x, faller.y, excludePlayerId, excludeEnemyId);
    if (pushed) messages.push(pushed);
  }
  return messages;
}

export function tickFallingStartOfTurn(
  state: GameState,
  unit: Elevatable,
  kind: "player" | "enemy",
): string[] {
  const messages: string[] = [];
  const tileElev = tileElevation(state, unit.x, unit.y);
  let elev = baseUnitElevation(state, unit);

  if (!unit.falling) {
    if (elev > 1 && !canMaintainElevation(unit)) {
      unit.falling = { peak: elev };
      messages.push(`began Falling (peak ${elev})`);
    } else {
      return messages;
    }
  }

  const prevElev = elev;
  elev = clampElevation(elev - 1);
  unit.elevation = elev;
  unit.falling.peak = Math.max(unit.falling.peak, prevElev);

  if (elev <= tileElev) {
    const peak = unit.falling.peak;
    const elevLost = Math.max(0, peak - tileElev);
    unit.elevation = tileElev;
    delete unit.falling;
    if (peak > 0) {
      dealElevDamage(unit, kind, peak);
      messages.push(`landed from Falling for ${peak} damage`);
    }
    messages.push(...applyLandingCollision(state, unit, kind, elevLost));
  } else {
    messages.push(`Falling → elevation ${elev}`);
  }

  return messages;
}

export function isUnitFalling(unit: Elevatable): boolean {
  return unit.falling != null;
}

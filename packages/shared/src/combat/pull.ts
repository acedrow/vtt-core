import type { Enemy, GameState, Player } from "../types.js";
import { buildBoardOccupancy, occupancyBlockedByEnemy } from "../game.js";
import {
  applySwarmMemberForcedMove,
  reconcileSwarmHp,
  snapshotSwarmGroups,
  swarmGroupForEnemy,
} from "./swarm.js";
import { coordKey, isInBounds, isWalkable, tileAt } from "../map.js";
import { enemyLabel, playerLabel } from "../console.js";
import { enemyFootprintTiles, getEnemyScale } from "../enemy-data.js";
import { applyVoidTileDefeat, enemyFullyOnVoid, isVoidTile } from "./void-tile.js";

export function isAttractorVoidTile(state: GameState, x: number, y: number): boolean {
  return (state.combat?.attractors ?? []).some((a) => a.x === x && a.y === y && a.void);
}

function isTileFreeForPull(
  state: GameState,
  occ: ReturnType<typeof buildBoardOccupancy>,
  x: number,
  y: number,
  excludeEnemyId?: string,
  excludePlayerId?: string,
): boolean {
  if (!isInBounds(x, y, state.width, state.height)) return false;
  const tile = tileAt(state.tiles, x, y);
  if (!tile) return false;
  if (!isVoidTile(state, x, y) && !isWalkable(tile)) return false;
  const key = coordKey(x, y);
  const p = occ.playerByKey.get(key);
  if (p && p.id !== excludePlayerId) return false;
  const e = occ.enemyByKey.get(key);
  if (e && e.id !== excludeEnemyId && occupancyBlockedByEnemy(occ, x, y)) return false;
  return true;
}

function isEnemyPullDestinationValid(
  state: GameState,
  occ: ReturnType<typeof buildBoardOccupancy>,
  anchorX: number,
  anchorY: number,
  scale: number,
  enemyId: string,
): boolean {
  for (const tile of enemyFootprintTiles(anchorX, anchorY, scale)) {
    if (!isInBounds(tile.x, tile.y, state.width, state.height)) return false;
    const mapTile = tileAt(state.tiles, tile.x, tile.y);
    if (!mapTile) return false;
    if (!isVoidTile(state, tile.x, tile.y) && !isWalkable(mapTile)) return false;
    const key = coordKey(tile.x, tile.y);
    if (occ.playerByKey.has(key)) return false;
    const enemy = occ.enemyByKey.get(key);
    if (enemy && enemy.id !== enemyId && occupancyBlockedByEnemy(occ, tile.x, tile.y)) return false;
  }
  return true;
}

function stepToward(fromX: number, fromY: number, towardX: number, towardY: number): { x: number; y: number } {
  const dx = towardX - fromX;
  const dy = towardY - fromY;
  if (Math.abs(dx) + Math.abs(dy) === 0) return { x: fromX, y: fromY };
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: fromX + Math.sign(dx), y: fromY };
  }
  return { x: fromX, y: fromY + Math.sign(dy) };
}

function applyPulledPlayer(player: Player, x: number, y: number): void {
  player.x = x;
  player.y = y;
}

function applyPulledEnemy(state: GameState, enemy: Enemy, x: number, y: number): void {
  const group = swarmGroupForEnemy(state, enemy.id);
  if (group && group.size > 1) {
    applySwarmMemberForcedMove(state, enemy.id, x, y);
    return;
  }
  const prev = snapshotSwarmGroups(state);
  const scale = getEnemyScale(enemy);
  const footprint = enemyFootprintTiles(x, y, scale);
  const anchor = footprint[0] ?? { x, y };
  enemy.x = anchor.x;
  enemy.y = anchor.y;
  reconcileSwarmHp(state, prev);
}

export function applyPullToward(
  state: GameState,
  unit: Player | Enemy,
  towardX: number,
  towardY: number,
  distance: number,
  opts?: { kind?: "player" | "enemy" },
): string {
  if (distance <= 0) return "";
  const kind = opts?.kind ?? ("weapon" in unit && unit.weapon !== undefined ? "player" : "enemy");
  const isPlayer = kind === "player";
  const startX = unit.x;
  const startY = unit.y;
  const parts: string[] = [];
  let cx = startX;
  let cy = startY;
  const excludeEnemyId = isPlayer ? undefined : unit.id;
  const excludePlayerId = isPlayer ? unit.id : undefined;

  for (let i = 0; i < distance; i++) {
    if (!isPlayer && (unit as Enemy).hp === 0) break;
    if (isPlayer && ((unit as Player).hp ?? 0) <= 0) break;

    const next = stepToward(cx, cy, towardX, towardY);
    if (next.x === cx && next.y === cy) break;

    const occ = buildBoardOccupancy(state);
    const canEnter = isPlayer
      ? isTileFreeForPull(state, occ, next.x, next.y, excludeEnemyId, excludePlayerId)
      : isEnemyPullDestinationValid(
          state,
          occ,
          next.x,
          next.y,
          getEnemyScale(unit as Enemy),
          unit.id,
        );
    if (!canEnter) break;

    cx = next.x;
    cy = next.y;
    parts.push(`(${cx},${cy})`);

    if (isPlayer) {
      applyPulledPlayer(unit as Player, cx, cy);
      const voidMsg = applyVoidTileDefeat(state, unit as Player, "player");
      if (voidMsg) {
        parts.push("void defeat");
        break;
      }
    } else {
      applyPulledEnemy(state, unit as Enemy, cx, cy);
      const enemy = unit as Enemy;
      if (enemyFullyOnVoid(state, enemy)) {
        enemy.hp = 0;
        parts.push("void defeat");
        break;
      }
    }
  }

  if (cx === startX && cy === startY) return "";

  if (isPlayer) {
    return `pulled ${playerLabel(unit as Player)} → ${parts.join(" → ")}`;
  }
  return `pulled ${enemyLabel(unit as Enemy)} → ${parts.join(" → ")}`;
}

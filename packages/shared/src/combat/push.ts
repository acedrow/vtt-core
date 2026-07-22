import type { Enemy, GameState, Player } from "../types.js";
import { buildBoardOccupancy, occupancyBlockedByEnemy } from "../game.js";
import {
  applySwarmMemberForcedMove,
  reconcileSwarmHp,
  snapshotSwarmGroups,
  swarmGroupForEnemy,
} from "./swarm.js";
import { coordKey, isInBounds, isWalkable, tileAt } from "../map.js";
import { enemyFootprintTiles, getEnemyScale } from "../enemy-data.js";
import { enemyLabel, playerLabel } from "../console.js";
import { applyDamageToEnemy, applyDamageToPlayer } from "./attack.js";
import { applyVoidTileDefeat, enemyFullyOnVoid, isVoidTile } from "./void-tile.js";
import { isTowerEnemy } from "./yadathan.js";
import { syncUnitElevationOnTile } from "./elevation.js";

export type PushUnitKind = "player" | "enemy";

export type PushOpts = {
  kind?: PushUnitKind;
  excludePlayerId?: string;
  excludeEnemyId?: string;
  verb?: string;
};

function pushDirection(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
): { dx: number; dy: number } {
  const dx = targetX - originX;
  const dy = targetY - originY;
  if (dx === 0 && dy === 0) return { dx: 0, dy: 0 };
  if (Math.abs(dx) >= Math.abs(dy)) return { dx: Math.sign(dx), dy: 0 };
  return { dx: 0, dy: Math.sign(dy) };
}

function isTileWalkableForPush(state: GameState, x: number, y: number): boolean {
  if (!isInBounds(x, y, state.width, state.height)) return false;
  const tile = tileAt(state.tiles, x, y);
  if (!tile) return false;
  return isVoidTile(state, x, y) || isWalkable(tile);
}

function isPlayerDestinationFree(
  state: GameState,
  occ: ReturnType<typeof buildBoardOccupancy>,
  x: number,
  y: number,
  excludePlayerId?: string,
  excludeEnemyId?: string,
): boolean {
  if (!isTileWalkableForPush(state, x, y)) return false;
  const key = coordKey(x, y);
  const player = occ.playerByKey.get(key);
  if (player && player.id !== excludePlayerId) return false;
  const enemy = occ.enemyByKey.get(key);
  if (enemy && enemy.id !== excludeEnemyId && occupancyBlockedByEnemy(occ, x, y)) return false;
  return true;
}

function isEnemyDestinationFree(
  state: GameState,
  occ: ReturnType<typeof buildBoardOccupancy>,
  anchorX: number,
  anchorY: number,
  scale: number,
  excludeEnemyId?: string,
  excludePlayerId?: string,
): boolean {
  for (const tile of enemyFootprintTiles(anchorX, anchorY, scale)) {
    if (!isTileWalkableForPush(state, tile.x, tile.y)) return false;
    const key = coordKey(tile.x, tile.y);
    const player = occ.playerByKey.get(key);
    if (player && player.id !== excludePlayerId) return false;
    const enemy = occ.enemyByKey.get(key);
    if (
      enemy &&
      enemy.id !== excludeEnemyId &&
      occupancyBlockedByEnemy(occ, tile.x, tile.y)
    ) {
      return false;
    }
  }
  return true;
}

function occupantAt(
  occ: ReturnType<typeof buildBoardOccupancy>,
  x: number,
  y: number,
  excludePlayerId?: string,
  excludeEnemyId?: string,
): { kind: "player"; unit: Player } | { kind: "enemy"; unit: Enemy } | null {
  const key = coordKey(x, y);
  const player = occ.playerByKey.get(key);
  if (player && player.id !== excludePlayerId) return { kind: "player", unit: player };
  const enemy = occ.enemyByKey.get(key);
  if (enemy && enemy.id !== excludeEnemyId && occupancyBlockedByEnemy(occ, x, y)) {
    return { kind: "enemy", unit: enemy };
  }
  return null;
}

function isPushableUnit(unit: Player | Enemy, kind: PushUnitKind): boolean {
  if (kind === "player") return true;
  const enemy = unit as Enemy;
  if (isTowerEnemy(enemy)) return false;
  return true;
}

function applyMovedPlayer(state: GameState, player: Player, x: number, y: number): string | null {
  player.x = x;
  player.y = y;
  syncUnitElevationOnTile(state, player, x, y);
  return applyVoidTileDefeat(state, player, "player");
}

function applyMovedEnemy(state: GameState, enemy: Enemy, x: number, y: number): string | null {
  const group = swarmGroupForEnemy(state, enemy.id);
  if (group && group.size > 1) {
    applySwarmMemberForcedMove(state, enemy.id, x, y);
  } else {
    const prev = snapshotSwarmGroups(state);
    const scale = getEnemyScale(enemy);
    const footprint = enemyFootprintTiles(x, y, scale);
    const anchor = footprint[0] ?? { x, y };
    enemy.x = anchor.x;
    enemy.y = anchor.y;
    reconcileSwarmHp(state, prev);
  }
  syncUnitElevationOnTile(state, enemy, enemy.x, enemy.y);
  if (enemyFullyOnVoid(state, enemy)) {
    enemy.hp = 0;
    return "void defeat";
  }
  return null;
}

function tryMovePlayerOneStep(
  state: GameState,
  player: Player,
  dx: number,
  dy: number,
  excludePlayerId?: string,
  excludeEnemyId?: string,
): { moved: boolean; blockedBy?: ReturnType<typeof occupantAt> } {
  const occ = buildBoardOccupancy(state);
  const nextX = player.x + dx;
  const nextY = player.y + dy;
  if (isPlayerDestinationFree(state, occ, nextX, nextY, excludePlayerId, excludeEnemyId)) {
    applyMovedPlayer(state, player, nextX, nextY);
    return { moved: true };
  }
  const blockedBy = occupantAt(occ, nextX, nextY, excludePlayerId, excludeEnemyId);
  return { moved: false, blockedBy: blockedBy ?? undefined };
}

function tryMoveEnemyOneStep(
  state: GameState,
  enemy: Enemy,
  dx: number,
  dy: number,
  excludePlayerId?: string,
  excludeEnemyId?: string,
): { moved: boolean; blockedBy?: ReturnType<typeof occupantAt> } {
  const occ = buildBoardOccupancy(state);
  const scale = getEnemyScale(enemy);
  const nextX = enemy.x + dx;
  const nextY = enemy.y + dy;
  const selfId = enemy.id;
  if (isEnemyDestinationFree(state, occ, nextX, nextY, scale, selfId, excludePlayerId)) {
    applyMovedEnemy(state, enemy, nextX, nextY);
    return { moved: true };
  }
  for (const tile of enemyFootprintTiles(nextX, nextY, scale)) {
    const blockedBy = occupantAt(occ, tile.x, tile.y, excludePlayerId, selfId);
    if (blockedBy && blockedBy.unit.id !== excludeEnemyId) return { moved: false, blockedBy };
  }
  return { moved: false };
}

function tryChainPushObstruction(
  state: GameState,
  obstruction: NonNullable<ReturnType<typeof occupantAt>>,
  dx: number,
  dy: number,
  excludePlayerId?: string,
  excludeEnemyId?: string,
): boolean {
  if (!isPushableUnit(obstruction.unit, obstruction.kind)) return false;
  if (obstruction.kind === "player") {
    return tryMovePlayerOneStep(
      state,
      obstruction.unit,
      dx,
      dy,
      excludePlayerId,
      excludeEnemyId,
    ).moved;
  }
  return tryMoveEnemyOneStep(
    state,
    obstruction.unit,
    dx,
    dy,
    excludePlayerId,
    excludeEnemyId,
  ).moved;
}

function unitLabel(unit: Player | Enemy, kind: PushUnitKind): string {
  return kind === "player" ? playerLabel(unit as Player) : enemyLabel(unit as Enemy);
}

export function applyPushFromOrigin(
  state: GameState,
  unit: Player | Enemy,
  originX: number,
  originY: number,
  distance: number,
  opts?: PushOpts,
): string {
  if (distance <= 0) return "";
  const kind = opts?.kind ?? ("weapon" in unit && unit.weapon !== undefined ? "player" : "enemy");
  const isPlayer = kind === "player";
  const startX = unit.x;
  const startY = unit.y;
  const { dx, dy } = pushDirection(originX, originY, startX, startY);
  if (dx === 0 && dy === 0) return "";

  const parts: string[] = [];
  let collisionDamage = 0;

  for (let step = 0; step < distance; step++) {
    if (isPlayer && ((unit as Player).hp ?? 0) <= 0) break;
    if (!isPlayer && (unit as Enemy).hp === 0) break;

    const result = isPlayer
      ? tryMovePlayerOneStep(
          state,
          unit as Player,
          dx,
          dy,
          opts?.excludePlayerId,
          opts?.excludeEnemyId,
        )
      : tryMoveEnemyOneStep(
          state,
          unit as Enemy,
          dx,
          dy,
          opts?.excludePlayerId,
          opts?.excludeEnemyId,
        );

    if (result.moved) {
      parts.push(`(${unit.x},${unit.y})`);
      continue;
    }

    collisionDamage += 1;
    if (result.blockedBy) {
      tryChainPushObstruction(
        state,
        result.blockedBy,
        dx,
        dy,
        opts?.excludePlayerId,
        opts?.excludeEnemyId,
      );
    }
  }

  if (collisionDamage > 0) {
    if (isPlayer) {
      applyDamageToPlayer(unit as Player, collisionDamage, state);
      parts.push(`${collisionDamage} collision`);
    } else {
      applyDamageToEnemy(unit as Enemy, collisionDamage, state);
      parts.push(`${collisionDamage} collision`);
    }
  }

  if (unit.x === startX && unit.y === startY && !collisionDamage) return "";
  const verb = opts?.verb ?? "pushed";
  return `${verb} ${unitLabel(unit, kind)} → ${parts.join(" → ")}`;
}

export function applyRecoilFromTarget(
  state: GameState,
  player: Player,
  targetX: number,
  targetY: number,
  distance: number,
): string {
  if (distance <= 0) return "";
  const dir = pushDirection(player.x, player.y, targetX, targetY);
  if (dir.dx === 0 && dir.dy === 0) return "";
  return applyPushFromOrigin(state, player, targetX, targetY, distance, {
    kind: "player",
    excludePlayerId: player.id,
    verb: "recoil",
  });
}

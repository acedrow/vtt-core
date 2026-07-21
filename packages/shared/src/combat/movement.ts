import type { Enemy, GameState, Player } from "../types.js";
import type { BoardCoord } from "../patterns.js";
import { isMovementStepAdjacent, isOrthogonallyAdjacent } from "../patterns.js";
import {
  areActionLimitsEnforced,
  buildBoardOccupancy,
  canPlayerMove,
  isSandboxMode,
  occupancyBlockedByEnemy,
  type BoardOccupancy,
} from "../game.js";
import { playerLabel } from "../console.js";
import { enemyFootprintTiles, getEnemyScale } from "../enemy-data.js";
import { coordKey, isInBounds, isWalkable, tileAt } from "../map.js";
import { getArmorSpeed } from "../player-data.js";
import { movementCostMultiplier } from "./effects.js";
import {
  clearAegisFlyingUsed,
  computePathCostWithFlying,
  spendAegisFlying,
  stepMoveCost,
  validateFlyingMask,
} from "./aegis.js";
import { canUseActionTier, spendActionTierOrHaste, spendMovement } from "./actions.js";
import { swarmGroupForEnemy } from "./content-modules-api.js";
import { combatMod } from "../combat-modules.js";
import { createDefaultActionBudget, type ActionBudget } from "./types.js";
import { enemyHasFlyingTag, isUnitFalling, syncUnitElevationOnTile } from "./elevation.js";

export type TerrainStepCostOpts = {
  seeking?: boolean;
  ignoreElevation?: boolean;
  flying?: boolean;
};

export type MovementStep = { x: number; y: number; cost: number };

export const MALAKBEL_ARMOR_NAME = "MALAKBEL";

const ORTHOGONAL_DELTAS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const DIAGONAL_DELTAS: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

type ReversalsModule = {
  isMalakbelArmorName: (name: string | undefined | null) => boolean;
  playerAllowsDiagonalMovement: (player: Pick<Player, "armor">) => boolean;
};

function reversals(): ReversalsModule {
  return combatMod("reversals") as ReversalsModule;
}

export function isMalakbelArmorName(name: string | undefined | null): boolean {
  return reversals().isMalakbelArmorName(name);
}

export function playerAllowsDiagonalMovement(player: Pick<Player, "armor">): boolean {
  return reversals().playerAllowsDiagonalMovement(player);
}

function movementStepDeltas(player: Player): [number, number][] {
  return playerAllowsDiagonalMovement(player)
    ? [...ORTHOGONAL_DELTAS, ...DIAGONAL_DELTAS]
    : ORTHOGONAL_DELTAS;
}

function terrainMoveCost(
  state: GameState,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  opts?: TerrainStepCostOpts,
): number {
  const fromTile = tileAt(state.tiles, fromX, fromY);
  const toTile = tileAt(state.tiles, toX, toY);
  if (!fromTile || !toTile) return 1;
  let cost = 1;
  const flying = opts?.flying === true;
  if (!flying && toTile.terrain.includes("uneasy")) cost += 1;
  if (opts?.ignoreElevation === true) return cost;
  // RAW: +1 Speed to enter higher elevation (flat), stacks with Uneasy
  // Flying treats origin as +1 elev (same as flyingStepCost)
  const fromElev = flying ? fromTile.elevation + 1 : fromTile.elevation;
  if (toTile.elevation > fromElev && opts?.seeking !== true) cost += 1;
  return cost;
}

export function terrainStepCost(
  state: GameState,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  opts?: TerrainStepCostOpts,
): number {
  return terrainMoveCost(state, fromX, fromY, toX, toY, opts);
}

export function enemyMoveStepCost(
  state: GameState,
  enemy: Enemy,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  opts?: { swarm?: boolean },
): number {
  const base = terrainMoveCost(state, fromX, fromY, toX, toY, {
    seeking: (enemy.effects?.Seeking ?? 0) > 0,
    ignoreElevation: opts?.swarm === true,
    flying: enemyHasFlyingTag(enemy),
  });
  return base * movementCostMultiplier(enemy.effects);
}

export function computePathCost(
  state: GameState,
  player: Player,
  path: BoardCoord[],
): { total: number; steps: MovementStep[] } | null {
  if (path.length === 0) return { total: 0, steps: [] };
  let cx = player.x;
  let cy = player.y;
  const mult = movementCostMultiplier(player.effects);
  const steps: MovementStep[] = [];
  let total = 0;
  const allowDiagonal = playerAllowsDiagonalMovement(player);
  for (const step of path) {
    if (!isMovementStepAdjacent({ x: cx, y: cy }, step, allowDiagonal)) return null;
    const seeking = (player.effects?.Seeking ?? 0) > 0;
    const base = terrainMoveCost(state, cx, cy, step.x, step.y, { seeking });
    const cost = base * mult;
    total += cost;
    steps.push({ x: step.x, y: step.y, cost });
    cx = step.x;
    cy = step.y;
  }
  return { total, steps };
}

export function maxSprintCost(player: Player): number {
  const speed = player.speed ?? getArmorSpeed(player.armor);
  // RAW p.98: round in the way most favorable to players
  return Math.ceil(speed / 2);
}

export function movementStepCost(
  state: GameState,
  player: Player,
  toX: number,
  toY: number,
): number {
  const seeking = (player.effects?.Seeking ?? 0) > 0;
  return (
    terrainMoveCost(state, player.x, player.y, toX, toY, { seeking }) *
    movementCostMultiplier(player.effects)
  );
}

export function clearSprintBudget(budget: ActionBudget | undefined): void {
  if (!budget) return;
  budget.sprintRemaining = 0;
  budget.sprintMax = 0;
}

export function findPlayerMovementPath(
  state: GameState,
  playerId: string,
  dest: BoardCoord,
): BoardCoord[] | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  if (player.x === dest.x && player.y === dest.y) return [];

  const occupancy = buildBoardOccupancy(state);
  const queue: { x: number; y: number; path: BoardCoord[] }[] = [
    { x: player.x, y: player.y, path: [] },
  ];
  const visited = new Set<string>([coordKey(player.x, player.y)]);

  while (queue.length > 0) {
    const { x, y, path } = queue.shift()!;
    for (const [dx, dy] of movementStepDeltas(player)) {
      const nx = x + dx;
      const ny = y + dy;
      const key = coordKey(nx, ny);
      if (visited.has(key)) continue;
      if (!isInBounds(nx, ny, state.width, state.height)) continue;
      if (!isWalkable(tileAt(state.tiles, nx, ny))) continue;
      if (occupancy.playerByKey.has(key)) continue;
      if (occupancyBlockedByEnemy(occupancy, nx, ny)) continue;
      visited.add(key);
      const nextPath = [...path, { x: nx, y: ny }];
      if (nx === dest.x && ny === dest.y) return nextPath;
      queue.push({ x: nx, y: ny, path: nextPath });
    }
  }
  return null;
}

export function normalizeMovementPath(
  state: GameState,
  playerId: string,
  path: BoardCoord[],
): BoardCoord[] | null {
  if (!path.length || areActionLimitsEnforced(state)) return path;
  if (path.length > 1) return path;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const dest = path[0]!;
  if (isMovementStepAdjacent({ x: player.x, y: player.y }, dest, playerAllowsDiagonalMovement(player))) {
    return path;
  }
  return findPlayerMovementPath(state, playerId, dest);
}

export function validateMovementPath(
  state: GameState,
  playerId: string,
  path: BoardCoord[],
  opts?: {
    allowOccupiedDestination?: boolean;
    skipMovementBudget?: boolean;
    flyingMask?: boolean[] | null;
  },
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Unknown player";
  if ((player.effects?.Pin ?? 0) > 0) return "Pinned — cannot move";
  if (isUnitFalling(player)) return "Falling — cannot spend Speed to move";
  if (!player.actionBudget) {
    const speed = player.speed ?? getArmorSpeed(player.armor);
    if (speed) player.actionBudget = createDefaultActionBudget(speed);
  }

  if (path.length === 0) return "Empty path";

  const flyingMask = opts?.flyingMask ?? null;
  let resolved = path;
  if (!flyingMask?.some(Boolean)) {
    const normalized = normalizeMovementPath(state, playerId, path);
    if (!normalized) return "No path to destination";
    resolved = normalized;
  }
  path = resolved;

  const flyingErr = validateFlyingMask(state, player, path, flyingMask);
  if (flyingErr) return flyingErr;

  const occupancy = buildBoardOccupancy(state);
  let cx = player.x;
  let cy = player.y;

  const allowDiagonal = playerAllowsDiagonalMovement(player);
  for (let i = 0; i < path.length; i++) {
    const step = path[i]!;
    const flying = flyingMask?.[i] ?? false;
    if (!isInBounds(step.x, step.y, state.width, state.height)) return "Out of bounds";
    if (!isMovementStepAdjacent({ x: cx, y: cy }, step, allowDiagonal)) {
      return "Path must be adjacent steps";
    }
    if (!flying && !isWalkable(tileAt(state.tiles, step.x, step.y))) return "Blocked";
    const key = coordKey(step.x, step.y);
    const isLast = i === path.length - 1;
    if (occupancy.playerByKey.has(key)) return "Tile occupied";
    if (occupancyBlockedByEnemy(occupancy, step.x, step.y)) {
      if (!(isLast && opts?.allowOccupiedDestination)) return "Tile occupied";
    }
    cx = step.x;
    cy = step.y;
  }

  const computed = computePathCostWithFlying(state, player, path, flyingMask);
  if (!computed) return "Invalid path";

  if (!isSandboxMode(state) && !opts?.skipMovementBudget) {
    const budget = player.actionBudget?.movementRemaining;
    if (budget !== undefined && computed.total > budget) return "Not enough movement";
  }
  return null;
}

export function applyMovementPath(
  state: GameState,
  playerId: string,
  path: BoardCoord[],
  opts?: { spendBudget?: boolean; flyingMask?: boolean[] | null },
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Unknown player";
  const flyingMask = opts?.flyingMask ?? null;
  let resolved = path;
  if (!flyingMask?.some(Boolean)) {
    const normalized = normalizeMovementPath(state, playerId, path);
    if (!normalized) return "No path to destination";
    resolved = normalized;
  }
  path = resolved;
  const err = validateMovementPath(state, playerId, path, { flyingMask });
  if (err) return err;
  const computed = computePathCostWithFlying(state, player, path, flyingMask)!;
  if (
    !isSandboxMode(state) &&
    opts?.spendBudget !== false &&
    player.actionBudget
  ) {
    if (!spendMovement(player.actionBudget, computed.total)) return "Not enough movement";
  }
  if (flyingMask) {
    spendAegisFlying(player, flyingMask.filter(Boolean).length);
  }
  const dest = path[path.length - 1]!;
  player.x = dest.x;
  player.y = dest.y;
  syncUnitElevationOnTile(state, player, dest.x, dest.y);
  return null;
}

export function adjacentEnemies(
  state: GameState,
  x: number,
  y: number,
  occupancy?: BoardOccupancy,
): string[] {
  const occ = occupancy ?? buildBoardOccupancy(state);
  const ids = new Set<string>();
  for (const [dx, dy] of ORTHOGONAL_DELTAS) {
    const enemy = occ.enemyByKey.get(coordKey(x + dx, y + dy));
    if (enemy) ids.add(enemy.id);
  }
  return [...ids];
}

function formlessTargetFootprintTiles(state: GameState, targetEnemyId: string): BoardCoord[] {
  const enemy = state.enemies.find((e) => e.id === targetEnemyId);
  if (!enemy) return [];
  const group = swarmGroupForEnemy(state, targetEnemyId);
  if (!group) return enemyFootprintTiles(enemy.x, enemy.y, getEnemyScale(enemy));
  const seen = new Set<string>();
  const tiles: BoardCoord[] = [];
  for (const id of group.memberIds) {
    const member = state.enemies.find((e) => e.id === id);
    if (!member) continue;
    for (const tile of enemyFootprintTiles(member.x, member.y, getEnemyScale(member))) {
      const key = coordKey(tile.x, tile.y);
      if (seen.has(key)) continue;
      seen.add(key);
      tiles.push(tile);
    }
  }
  return tiles;
}

export function formlessTargetTileKeys(
  state: GameState,
  playerX: number,
  playerY: number,
): Set<string> {
  const keys = new Set<string>();
  const player = { x: playerX, y: playerY };
  for (const id of adjacentEnemies(state, playerX, playerY)) {
    const enemy = state.enemies.find((e) => e.id === id);
    if (!enemy) continue;
    for (const tile of enemyFootprintTiles(enemy.x, enemy.y, getEnemyScale(enemy))) {
      if (isOrthogonallyAdjacent(player, tile)) keys.add(coordKey(tile.x, tile.y));
    }
  }
  return keys;
}

export function formlessLandingTiles(
  state: GameState,
  _playerId: string,
  targetEnemyId: string,
): { x: number; y: number }[] {
  const footprint = formlessTargetFootprintTiles(state, targetEnemyId);
  if (!footprint.length) return [];

  const occ = buildBoardOccupancy(state);
  const seen = new Set<string>();
  const landings: { x: number; y: number }[] = [];

  for (const ft of footprint) {
    for (const [dx, dy] of ORTHOGONAL_DELTAS) {
      const x = ft.x + dx;
      const y = ft.y + dy;
      const key = coordKey(x, y);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!isInBounds(x, y, state.width, state.height)) continue;
      if (!isWalkable(tileAt(state.tiles, x, y))) continue;
      if (occ.playerByKey.has(key)) continue;
      if (occupancyBlockedByEnemy(occ, x, y)) continue;
      landings.push({ x, y });
    }
  }

  return landings;
}

export function adjacentPlayers(
  state: GameState,
  x: number,
  y: number,
  excludeId?: string,
  occupancy?: BoardOccupancy,
): string[] {
  const occ = occupancy ?? buildBoardOccupancy(state);
  const ids: string[] = [];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const p = occ.playerByKey.get(coordKey(x + dx, y + dy));
    if (p && p.id !== excludeId) ids.push(p.id);
  }
  return ids;
}

export function validateResetMovement(state: GameState, playerId: string): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Unknown player";
  if (!canPlayerMove(state, playerId)) return "Not your turn";
  if (state.roundPhase === "deployment") return "Wrong phase";
  if (player.turnStartX === undefined || player.turnStartY === undefined) return "No turn start recorded";
  if (!player.actionBudget) {
    const speed = player.speed ?? getArmorSpeed(player.armor);
    if (speed) player.actionBudget = createDefaultActionBudget(speed);
  }
  if (areActionLimitsEnforced(state) && player.actionBudget) {
    if (!player.actionBudget.main || !player.actionBudget.support || !player.actionBudget.aux) {
      return "Actions already spent";
    }
    if (state.combat?.pendingActions.some((p) => p.actorPlayerId === playerId)) {
      return "Pending actions";
    }
  }
  return null;
}

export function applyResetMovement(state: GameState, playerId: string): string {
  const player = state.players.find((p) => p.id === playerId)!;
  player.x = player.turnStartX!;
  player.y = player.turnStartY!;
  if (player.actionBudget) {
    player.actionBudget.movementRemaining = player.actionBudget.movementMax;
    clearSprintBudget(player.actionBudget);
  }
  if (player.counters?.assistedLaunchUsed != null) {
    delete player.counters.assistedLaunchUsed;
    if (Object.keys(player.counters).length === 0) delete player.counters;
  }
  clearAegisFlyingUsed(player);
  return `${playerLabel(player)} reset movement`;
}

export function validateSprintBegin(state: GameState, playerId: string): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Unknown player";
  if (!canPlayerMove(state, playerId)) return "Not your turn";
  if (state.roundPhase === "deployment") return "Wrong phase";
  if ((player.effects?.Pin ?? 0) > 0) return "Pinned — cannot Sprint";
  if (isUnitFalling(player)) return "Falling — cannot Sprint";
  if (!player.actionBudget) {
    const speed = player.speed ?? getArmorSpeed(player.armor);
    if (speed) player.actionBudget = createDefaultActionBudget(speed);
  }
  if ((player.actionBudget?.sprintRemaining ?? 0) > 0) return "Already sprinting";
  if (areActionLimitsEnforced(state) && !canUseActionTier(player, "aux")) {
    return "Aux action spent";
  }
  if (maxSprintCost(player) <= 0) return "No sprint movement";
  return null;
}

export function applySprintBegin(state: GameState, playerId: string): string {
  const player = state.players.find((p) => p.id === playerId)!;
  if (areActionLimitsEnforced(state)) spendActionTierOrHaste(player, "aux");
  const max = maxSprintCost(player);
  player.actionBudget!.sprintRemaining = max;
  player.actionBudget!.sprintMax = max;
  return `${playerLabel(player)} started sprint (${max} movement)`;
}

export function validateSprintMove(
  state: GameState,
  playerId: string,
  x: number,
  y: number,
  opts?: { flying?: boolean },
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Unknown player";
  if (!canPlayerMove(state, playerId)) return "Not your turn";
  if (state.roundPhase === "deployment") return "Wrong phase";
  if ((player.effects?.Pin ?? 0) > 0) return "Pinned — cannot Sprint";
  const remaining = player.actionBudget?.sprintRemaining ?? 0;
  if (remaining <= 0) return "No sprint movement remaining";
  const flying = opts?.flying ?? false;
  const flyingMask = flying ? [true] : null;
  const err = validateMovementPath(state, playerId, [{ x, y }], {
    skipMovementBudget: true,
    flyingMask,
  });
  if (err) return err;
  const cost = stepMoveCost(state, player, { x: player.x, y: player.y }, { x, y }, flying);
  if (cost > remaining) return "Not enough sprint movement";
  return null;
}

export function applySprintMove(
  state: GameState,
  playerId: string,
  x: number,
  y: number,
  opts?: { flying?: boolean },
): string {
  const player = state.players.find((p) => p.id === playerId)!;
  const flying = opts?.flying ?? false;
  const cost = stepMoveCost(state, player, { x: player.x, y: player.y }, { x, y }, flying);
  if (flying) spendAegisFlying(player, 1);
  player.x = x;
  player.y = y;
  syncUnitElevationOnTile(state, player, x, y);
  const budget = player.actionBudget!;
  budget.sprintRemaining = Math.max(0, (budget.sprintRemaining ?? 0) - cost);
  if (budget.sprintRemaining <= 0) clearSprintBudget(budget);
  return `${playerLabel(player)} sprinted to (${x}, ${y})`;
}

export function validateSprintCancel(state: GameState, playerId: string): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Unknown player";
  if ((player.actionBudget?.sprintRemaining ?? 0) <= 0) return "Not sprinting";
  return null;
}

export function applySprintCancel(state: GameState, playerId: string): string {
  const player = state.players.find((p) => p.id === playerId)!;
  clearSprintBudget(player.actionBudget);
  return `${playerLabel(player)} ended sprint`;
}

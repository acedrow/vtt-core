import type { BoardCoord } from "../patterns.js";
import { isMovementStepAdjacent } from "../patterns.js";
import type { GameState, Player } from "../types.js";
import { buildBoardOccupancy, occupancyBlockedByEnemy } from "../game.js";
import { coordKey, isInBounds, isWalkable, tileAt } from "../map.js";
import { movementCostMultiplier } from "./effects.js";
import { playerArmorGearName } from "./attractor.js";

export const ASSISTED_ASCENSION_GEAR = "Assisted Ascension Module (Armor)";

function playerAllowsDiagonalMovement(player: Pick<Player, "armor">): boolean {
  return player.armor === "MALAKBEL";
}

export function hasAssistedAscensionGear(player: Player): boolean {
  return playerArmorGearName(player) === ASSISTED_ASCENSION_GEAR;
}

export function playerAegisStacks(player: Player): number {
  return player.effects?.Aegis ?? 0;
}

export function aegisFlyingUsed(player: Player): number {
  return player.counters?.aegisFlyingUsed ?? 0;
}

export function aegisFlyingRemaining(player: Player): number {
  return Math.max(0, playerAegisStacks(player) - aegisFlyingUsed(player));
}

export function ensureAssistedAscensionAegis(player: Player): void {
  if (!hasAssistedAscensionGear(player)) return;
  if (playerAegisStacks(player) >= 1) return;
  if (!player.effects) player.effects = {};
  player.effects.Aegis = 1;
}

export function clampAssistedAscensionAegis(player: Player): void {
  if (!hasAssistedAscensionGear(player)) return;
  if (playerAegisStacks(player) >= 1) return;
  if (!player.effects) player.effects = {};
  player.effects.Aegis = 1;
}

export function resolveFlyingMask(
  pathLength: number,
  flying?: boolean | boolean[],
): boolean[] | null {
  if (flying === undefined) return null;
  if (typeof flying === "boolean") return Array.from({ length: pathLength }, () => flying);
  if (flying.length !== pathLength) return null;
  return flying;
}

export function spendAegisFlying(player: Player, count: number): void {
  if (count <= 0) return;
  if (!player.counters) player.counters = {};
  player.counters.aegisFlyingUsed = aegisFlyingUsed(player) + count;
}

export function clearAegisFlyingUsed(player: Player): void {
  if (player.counters?.aegisFlyingUsed == null) return;
  delete player.counters.aegisFlyingUsed;
  if (Object.keys(player.counters).length === 0) delete player.counters;
}

function stepDestinationFree(
  state: GameState,
  playerId: string,
  x: number,
  y: number,
  occupancy?: ReturnType<typeof buildBoardOccupancy>,
): boolean {
  const occ = occupancy ?? buildBoardOccupancy(state);
  const key = coordKey(x, y);
  const otherPlayer = occ.playerByKey.get(key);
  if (otherPlayer && otherPlayer.id !== playerId) return false;
  if (occupancyBlockedByEnemy(occ, x, y)) return false;
  return true;
}

export function isFlyingStepReachable(
  state: GameState,
  player: Player,
  from: BoardCoord,
  to: BoardCoord,
  opts?: { occupancy?: ReturnType<typeof buildBoardOccupancy> },
): boolean {
  const allowDiagonal = playerAllowsDiagonalMovement(player);
  if (!isMovementStepAdjacent(from, to, allowDiagonal)) return false;
  if (!isInBounds(to.x, to.y, state.width, state.height)) return false;
  if (!stepDestinationFree(state, player.id, to.x, to.y, opts?.occupancy)) return false;
  return true;
}

export function isGroundStepReachable(
  state: GameState,
  player: Player,
  from: BoardCoord,
  to: BoardCoord,
  opts?: { occupancy?: ReturnType<typeof buildBoardOccupancy> },
): boolean {
  if (!isFlyingStepReachable(state, player, from, to, opts)) return false;
  return isWalkable(tileAt(state.tiles, to.x, to.y));
}

export function isStepReachable(
  state: GameState,
  player: Player,
  from: BoardCoord,
  to: BoardCoord,
  flying: boolean,
  opts?: { occupancy?: ReturnType<typeof buildBoardOccupancy> },
): boolean {
  return flying
    ? isFlyingStepReachable(state, player, from, to, opts)
    : isGroundStepReachable(state, player, from, to, opts);
}

export function flyingStepCost(
  state: GameState,
  player: Player,
  from: BoardCoord,
  to: BoardCoord,
): number {
  const fromTile = tileAt(state.tiles, from.x, from.y);
  const toTile = tileAt(state.tiles, to.x, to.y);
  if (!fromTile || !toTile) return movementCostMultiplier(player.effects);
  const effectiveFromElev = fromTile.elevation + 1;
  let cost = 1;
  // RAW: flat +1 to enter higher elevation; Flying treats origin as +1 elev
  if (toTile.elevation > effectiveFromElev) cost += 1;
  return cost * movementCostMultiplier(player.effects);
}

export function stepMoveCost(
  state: GameState,
  player: Player,
  from: BoardCoord,
  to: BoardCoord,
  flying: boolean,
): number {
  if (flying) return flyingStepCost(state, player, from, to);
  const fromTile = tileAt(state.tiles, from.x, from.y);
  const toTile = tileAt(state.tiles, to.x, to.y);
  if (!fromTile || !toTile) return movementCostMultiplier(player.effects);
  let cost = 1;
  if (toTile.terrain.includes("uneasy")) cost += 1;
  // RAW: +1 Speed to enter higher elevation (flat)
  if (toTile.elevation > fromTile.elevation) {
    const seeking = (player.effects?.Seeking ?? 0) > 0;
    if (!seeking) cost += 1;
  }
  return cost * movementCostMultiplier(player.effects);
}

export function validateFlyingMask(
  state: GameState,
  player: Player,
  path: BoardCoord[],
  flyingMask: boolean[] | null,
): string | null {
  if (!flyingMask) return null;
  const flyingSteps = flyingMask.filter(Boolean).length;
  if (flyingSteps > aegisFlyingRemaining(player)) return "Not enough Aegis flight";
  const occupancy = buildBoardOccupancy(state);
  let cx = player.x;
  let cy = player.y;
  for (let i = 0; i < path.length; i++) {
    const step = path[i]!;
    const flying = flyingMask[i]!;
    const from = { x: cx, y: cy };
    if (!isStepReachable(state, player, from, step, flying, { occupancy })) {
      return flying ? "Invalid flying step" : "Blocked";
    }
    cx = step.x;
    cy = step.y;
  }
  return null;
}

export function computePathCostWithFlying(
  state: GameState,
  player: Player,
  path: BoardCoord[],
  flyingMask: boolean[] | null,
): { total: number; steps: { x: number; y: number; cost: number }[] } | null {
  if (path.length === 0) return { total: 0, steps: [] };
  const maskErr = validateFlyingMask(state, player, path, flyingMask);
  if (maskErr) return null;

  let cx = player.x;
  let cy = player.y;
  const steps: { x: number; y: number; cost: number }[] = [];
  let total = 0;
  const allowDiagonal = playerAllowsDiagonalMovement(player);

  for (let i = 0; i < path.length; i++) {
    const step = path[i]!;
    const flying = flyingMask?.[i] ?? false;
    if (!isMovementStepAdjacent({ x: cx, y: cy }, step, allowDiagonal)) return null;
    const from = { x: cx, y: cy };
    if (!flyingMask && !isGroundStepReachable(state, player, from, step)) return null;
    const cost = stepMoveCost(state, player, from, step, flying);
    total += cost;
    steps.push({ x: step.x, y: step.y, cost });
    cx = step.x;
    cy = step.y;
  }
  return { total, steps };
}

import type { BoardCoord } from "../patterns.js";
import { isOrthogonallyAdjacent } from "../patterns.js";
import type { GameState, Player } from "../types.js";
import {
  buildBoardOccupancy,
  canPlayerMove,
  isPlayerDowned,
  occupancyBlockedByEnemy,
} from "../game.js";
import { playerLabel } from "../console.js";
import { coordKey, isImpassableOrObstacleTile, isInBounds, isWalkable, tileAt } from "../map.js";
import { isSpecialTerrainTile } from "./provoke.js";

export const KUSHIEL_ARMOR_NAME = "KUSHIEL";

export type AssistedLaunchAnchor = {
  x: number;
  y: number;
  kind: "impassable" | "obstacle" | "edge" | "ally";
  allyId?: string;
};

export type AssistedLaunchResult = {
  path: BoardCoord[];
  landing: BoardCoord;
};

export function isKushielArmorName(name: string | undefined | null): boolean {
  return name === KUSHIEL_ARMOR_NAME;
}

function isAtTurnStart(player: Player): boolean {
  return (
    player.turnStartX === player.x &&
    player.turnStartY === player.y &&
    player.turnStartX !== undefined &&
    player.turnStartY !== undefined
  );
}

function isLaunchCollisionTile(
  state: GameState,
  occ: ReturnType<typeof buildBoardOccupancy>,
  x: number,
  y: number,
  playerId: string,
): boolean {
  if (!isInBounds(x, y, state.width, state.height)) return true;
  const tile = tileAt(state.tiles, x, y);
  if (!tile || isImpassableOrObstacleTile(tile) || !isWalkable(tile)) return true;
  if (isSpecialTerrainTile(tile)) return true;
  const key = coordKey(x, y);
  const ally = occ.playerByKey.get(key);
  if (ally && ally.id !== playerId) return true;
  if (occupancyBlockedByEnemy(occ, x, y)) return true;
  return false;
}

export function computeAssistedLaunch(
  state: GameState,
  playerId: string,
  anchorX: number,
  anchorY: number,
  occ = buildBoardOccupancy(state),
): AssistedLaunchResult | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const startX = player.turnStartX ?? player.x;
  const startY = player.turnStartY ?? player.y;
  if (!isOrthogonallyAdjacent({ x: startX, y: startY }, { x: anchorX, y: anchorY })) return null;

  const dx = Math.sign(startX - anchorX);
  const dy = Math.sign(startY - anchorY);
  if (dx === 0 && dy === 0) return null;

  const path: BoardCoord[] = [];
  let cx = startX;
  let cy = startY;

  while (true) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (isLaunchCollisionTile(state, occ, nx, ny, playerId)) break;
    path.push({ x: nx, y: ny });
    cx = nx;
    cy = ny;
  }

  if (path.length === 0) return null;
  const landing = path[path.length - 1]!;
  return { path, landing };
}

export function assistedLaunchAnchors(state: GameState, playerId: string): AssistedLaunchAnchor[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  const startX = player.turnStartX ?? player.x;
  const startY = player.turnStartY ?? player.y;
  const occ = buildBoardOccupancy(state);
  const anchors: AssistedLaunchAnchor[] = [];

  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]) {
    const x = startX + dx;
    const y = startY + dy;
    if (!isInBounds(x, y, state.width, state.height)) {
      if (computeAssistedLaunch(state, playerId, x, y, occ)) {
        anchors.push({ x, y, kind: "edge" });
      }
      continue;
    }
    const ally = occ.playerByKey.get(coordKey(x, y));
    if (ally && ally.id !== playerId && !isPlayerDowned(ally)) {
      if (computeAssistedLaunch(state, playerId, x, y, occ)) {
        anchors.push({ x, y, kind: "ally", allyId: ally.id });
      }
      continue;
    }
    const tile = tileAt(state.tiles, x, y);
    if (isImpassableOrObstacleTile(tile)) {
      if (computeAssistedLaunch(state, playerId, x, y, occ)) {
        anchors.push({
          x,
          y,
          kind: tile!.terrain.includes("obstacle") ? "obstacle" : "impassable",
        });
      }
    }
  }

  return anchors;
}

export function canUseAssistedLaunch(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !isKushielArmorName(player.armor)) return false;
  if (!canPlayerMove(state, playerId)) return false;
  if (state.roundPhase === "deployment") return false;
  if ((player.effects?.Pin ?? 0) > 0) return false;
  if (!isAtTurnStart(player)) return false;
  if ((player.counters?.assistedLaunchUsed ?? 0) > 0) return false;
  return assistedLaunchAnchors(state, playerId).length > 0;
}

export function validateAssistedLaunch(
  state: GameState,
  playerId: string,
  anchorX: number,
  anchorY: number,
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Unknown player";
  if (!isKushielArmorName(player.armor)) return "Not wearing KUSHIEL";
  if (!canPlayerMove(state, playerId)) return "Not your turn";
  if (state.roundPhase === "deployment") return "Wrong phase";
  if ((player.effects?.Pin ?? 0) > 0) return "Pinned — cannot move";
  if (!isAtTurnStart(player)) return "Must be at turn-start position";
  if ((player.counters?.assistedLaunchUsed ?? 0) > 0) return "Assisted Launch already used";

  const anchors = assistedLaunchAnchors(state, playerId);
  const anchor = anchors.find((a) => a.x === anchorX && a.y === anchorY);
  if (!anchor) return "Invalid launch anchor";

  const result = computeAssistedLaunch(state, playerId, anchorX, anchorY);
  if (!result) return "No valid launch path";
  return null;
}

export function applyAssistedLaunch(
  state: GameState,
  playerId: string,
  anchorX: number,
  anchorY: number,
): { landing: BoardCoord; path: BoardCoord[] } {
  const player = state.players.find((p) => p.id === playerId)!;
  const result = computeAssistedLaunch(state, playerId, anchorX, anchorY)!;
  player.x = result.landing.x;
  player.y = result.landing.y;
  if (!player.counters) player.counters = {};
  player.counters.assistedLaunchUsed = 1;
  return result;
}

export function formatAssistedLaunchMessage(
  player: Player,
  result: AssistedLaunchResult,
): string {
  const steps = result.path.map((t) => `(${t.x}, ${t.y})`).join(" → ");
  return `${playerLabel(player)} Assisted Launch → ${steps}`;
}

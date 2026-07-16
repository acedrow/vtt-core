import type { Enemy, GameState, Player } from "../types.js";
import { tileAt } from "../map.js";
import {
  effectiveElevation,
  tileElevation,
  unitHasSeeking,
  unitPiercingStacks,
} from "./elevation.js";

function terrainBlocksLos(tile: ReturnType<typeof tileAt>): boolean {
  if (!tile) return true;
  return tile.terrain.includes("obstacle");
}

function elevationBlocksLos(
  blockerElev: number,
  viewerElev: number,
  targetElev: number,
): boolean {
  return blockerElev > viewerElev && blockerElev > targetElev;
}

function elevationBlocksLosDepression(
  tileX: number,
  tileY: number,
  tileElev: number,
  fromX: number,
  fromY: number,
  viewerElev: number,
  toX: number,
  toY: number,
  targetElev: number,
): boolean {
  const totalDist = Math.hypot(toX - fromX, toY - fromY);
  if (totalDist === 0) return false;
  const t = Math.hypot(tileX - fromX, tileY - fromY) / totalDist;
  const sightPlane = viewerElev + (targetElev - viewerElev) * t;
  return tileElev > sightPlane && tileElev >= viewerElev;
}

export function tilesOnLine(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  let x0 = a.x;
  let y0 = a.y;
  const x1 = b.x;
  const y1 = b.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    tiles.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return tiles;
}

export function tilesOnSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number }[] {
  return tilesOnLine(a, b);
}

export function tilesBetween(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { x: number; y: number }[] {
  const line = tilesOnLine({ x: fromX, y: fromY }, { x: toX, y: toY });
  if (line.length <= 2) return [];
  return line.slice(1, -1);
}

export type LineOfSightOpts = {
  piercing?: number;
  seeking?: boolean;
  viewer?: Player | Enemy;
  target?: Player | Enemy;
};

export function hasLineOfSight(
  state: GameState,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  opts?: LineOfSightOpts,
): boolean {
  if (fromX === toX && fromY === toY) return true;

  const viewerElev = opts?.viewer
    ? effectiveElevation(state, opts.viewer)
    : tileElevation(state, fromX, fromY);
  const targetElev = opts?.target
    ? effectiveElevation(state, opts.target)
    : tileElevation(state, toX, toY);
  const seeking = opts?.seeking === true || (opts?.viewer != null && unitHasSeeking(opts.viewer));
  let piercingLeft = Math.max(
    0,
    opts?.piercing ?? (opts?.viewer != null ? unitPiercingStacks(opts.viewer) : 0),
  );

  for (const tile of tilesBetween(fromX, fromY, toX, toY)) {
    const mapTile = tileAt(state.tiles, tile.x, tile.y);
    if (terrainBlocksLos(mapTile)) {
      if (piercingLeft > 0) {
        piercingLeft -= 1;
      } else {
        return false;
      }
    }
    if (!seeking) {
      const elev = tileElevation(state, tile.x, tile.y);
      if (targetElev < viewerElev) {
        if (
          elevationBlocksLosDepression(
            tile.x,
            tile.y,
            elev,
            fromX,
            fromY,
            viewerElev,
            toX,
            toY,
            targetElev,
          )
        ) {
          return false;
        }
      } else if (elevationBlocksLos(elev, viewerElev, targetElev)) {
        return false;
      }
    }
  }
  return true;
}

export function tilesInManhattanRange(
  ox: number,
  oy: number,
  range: number,
  width: number,
  height: number,
): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.abs(x - ox) + Math.abs(y - oy) <= range) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

export function visibleTileKeys(
  state: GameState,
  ox: number,
  oy: number,
  opts?: { maxRange?: number } & LineOfSightOpts,
): Set<string> {
  const keys = new Set<string>();
  const candidates =
    opts?.maxRange != null
      ? tilesInManhattanRange(ox, oy, opts.maxRange, state.width, state.height)
      : state.tiles.map((t) => ({ x: t.x, y: t.y }));

  for (const tile of candidates) {
    if (tile.x === ox && tile.y === oy) continue;
    if (hasLineOfSight(state, ox, oy, tile.x, tile.y, opts)) {
      keys.add(`${tile.x},${tile.y}`);
    }
  }
  return keys;
}

export function visibleEnemyIds(
  state: GameState,
  playerId: string,
  opts?: { maxRange?: number } & LineOfSightOpts,
): string[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  return state.enemies
    .filter((e) => {
      if (opts?.maxRange != null) {
        const dist = Math.abs(e.x - player.x) + Math.abs(e.y - player.y);
        if (dist > opts.maxRange) return false;
      }
      return hasLineOfSight(state, player.x, player.y, e.x, e.y, {
        ...opts,
        viewer: player,
        target: e,
      });
    })
    .map((e) => e.id);
}

export function outOfLineOfSightTileKeys(
  state: GameState,
  ox: number,
  oy: number,
  opts?: LineOfSightOpts,
): Set<string> {
  const visible = visibleTileKeys(state, ox, oy, opts);
  const keys = new Set<string>();
  for (const tile of state.tiles) {
    if (tile.x === ox && tile.y === oy) continue;
    const key = `${tile.x},${tile.y}`;
    if (!visible.has(key)) keys.add(key);
  }
  return keys;
}

export function tilesOnCardinalLine(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  const dx = Math.sign(toX - fromX);
  const dy = Math.sign(toY - fromY);
  if (dx === 0 && dy === 0) return tiles;
  if (dx !== 0 && dy !== 0) return tiles;

  let x = fromX + dx;
  let y = fromY + dy;
  while (x !== toX || y !== toY) {
    tiles.push({ x, y });
    x += dx;
    y += dy;
  }
  tiles.push({ x: toX, y: toY });
  return tiles;
}

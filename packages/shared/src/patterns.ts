import type { PatternDirection, PatternModifierValues } from "./pattern-data.js";

export type BoardCoord = { x: number; y: number };

export type PatternTileOptions = {
  ringGap?: number;
  lopsidedExtra?: "left" | "right";
  modifiers?: PatternModifierValues;
};

const DIR_DELTA: Record<PatternDirection, BoardCoord> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};

const PERP_DELTA: Record<PatternDirection, BoardCoord> = {
  n: { x: 1, y: 0 },
  e: { x: 0, y: 1 },
  s: { x: 1, y: 0 },
  w: { x: 0, y: 1 },
};

function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

function addCoord(origin: BoardCoord, dx: number, dy: number): BoardCoord {
  return { x: origin.x + dx, y: origin.y + dy };
}

function inBounds(
  coord: BoardCoord,
  width: number,
  height: number,
): boolean {
  return coord.x >= 0 && coord.y >= 0 && coord.x < width && coord.y < height;
}

function filterInBounds(
  coords: BoardCoord[],
  width: number,
  height: number,
): BoardCoord[] {
  return coords.filter((c) => inBounds(c, width, height));
}

function oppositeDirection(direction: PatternDirection): PatternDirection {
  const map: Record<PatternDirection, PatternDirection> = {
    n: "s",
    s: "n",
    e: "w",
    w: "e",
  };
  return map[direction];
}

function offsetOrigin(
  origin: BoardCoord,
  direction: PatternDirection,
  distance: number,
): BoardCoord {
  const delta = DIR_DELTA[direction];
  return {
    x: origin.x + delta.x * distance,
    y: origin.y + delta.y * distance,
  };
}

function manhattanDistance(a: BoardCoord, b: BoardCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function rangeOnlyTiles(origin: BoardCoord, range: number): BoardCoord[] {
  const tiles: BoardCoord[] = [];
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const coord = { x: origin.x + dx, y: origin.y + dy };
      if (manhattanDistance(origin, coord) <= range) {
        tiles.push(coord);
      }
    }
  }
  return tiles;
}

export function lineTilesWithWidth(
  origin: BoardCoord,
  length: number,
  width: number,
  direction: PatternDirection,
  lopsidedExtra: "left" | "right" = "right",
): BoardCoord[] {
  const forward = DIR_DELTA[direction];
  const lateral = PERP_DELTA[direction];
  const tiles: BoardCoord[] = [];
  const leftCount =
    width % 2 === 0 && lopsidedExtra === "left" ? width - 1 : Math.floor((width - 1) / 2);
  const rightCount =
    width % 2 === 0 && lopsidedExtra === "right" ? width - 1 : Math.ceil((width - 1) / 2);

  for (let depth = 1; depth <= length; depth++) {
    const center = {
      x: origin.x + forward.x * depth,
      y: origin.y + forward.y * depth,
    };
    tiles.push(center);
    for (let i = 1; i <= leftCount; i++) {
      tiles.push({ x: center.x - lateral.x * i, y: center.y - lateral.y * i });
    }
    for (let i = 1; i <= rightCount; i++) {
      tiles.push({ x: center.x + lateral.x * i, y: center.y + lateral.y * i });
    }
  }
  return tiles;
}

export function recoilTiles(
  origin: BoardCoord,
  recoil: number,
  direction: PatternDirection,
): BoardCoord[] {
  const delta = DIR_DELTA[oppositeDirection(direction)];
  const tiles: BoardCoord[] = [];
  for (let i = 1; i <= recoil; i++) {
    tiles.push({ x: origin.x + delta.x * i, y: origin.y + delta.y * i });
  }
  return tiles;
}

function chebyshevDistance(a: BoardCoord, b: BoardCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function burstTiles(origin: BoardCoord, size: number): BoardCoord[] {
  const out: BoardCoord[] = [];
  for (let dy = -size; dy <= size; dy++) {
    for (let dx = -size; dx <= size; dx++) {
      out.push({ x: origin.x + dx, y: origin.y + dy });
    }
  }
  return out;
}

export function blastTiles(
  origin: BoardCoord,
  size: number,
  direction: PatternDirection,
): BoardCoord[] {
  if (size === 1) {
    const tiles = [origin];
    for (const d of ["n", "e", "s", "w"] as PatternDirection[]) {
      const delta = DIR_DELTA[d];
      tiles.push(addCoord(origin, delta.x, delta.y));
    }
    return tiles;
  }

  const dim = 2 * size - 1;
  const forward = DIR_DELTA[direction];
  const lateral = PERP_DELTA[direction];
  const tiles: BoardCoord[] = [];
  const backOffset = size - 1;

  for (let f = 0; f < dim; f++) {
    for (let l = -backOffset; l <= backOffset; l++) {
      tiles.push({
        x: origin.x + forward.x * f + lateral.x * l,
        y: origin.y + forward.y * f + lateral.y * l,
      });
    }
  }
  return tiles;
}

export function lineTiles(
  origin: BoardCoord,
  size: number,
  direction: PatternDirection,
): BoardCoord[] {
  const delta = DIR_DELTA[direction];
  const tiles: BoardCoord[] = [];
  for (let i = 1; i <= size; i++) {
    tiles.push({
      x: origin.x + delta.x * i,
      y: origin.y + delta.y * i,
    });
  }
  return tiles;
}

export function chargeTiles(
  origin: BoardCoord,
  size: number,
  direction: PatternDirection,
): BoardCoord[] {
  return lineTiles(origin, size, direction);
}

export function coneTiles(
  origin: BoardCoord,
  size: number,
  direction: PatternDirection,
): BoardCoord[] {
  const forward = DIR_DELTA[direction];
  const lateral = PERP_DELTA[direction];
  const tiles: BoardCoord[] = [];

  for (let depth = 1; depth <= size; depth++) {
    const width = 2 * depth - 1;
    const half = Math.floor(width / 2);
    for (let offset = -half; offset <= half; offset++) {
      tiles.push({
        x: origin.x + forward.x * depth + lateral.x * offset,
        y: origin.y + forward.y * depth + lateral.y * offset,
      });
    }
  }
  return tiles;
}

export function starTiles(origin: BoardCoord, size: number): BoardCoord[] {
  const tiles: BoardCoord[] = [origin];
  const diagonals = [
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ];
  for (const diag of diagonals) {
    for (let i = 1; i <= size; i++) {
      tiles.push({ x: origin.x + diag.x * i, y: origin.y + diag.y * i });
    }
  }
  return tiles;
}

export function ringTiles(
  origin: BoardCoord,
  ringWidth: number,
  range = 1,
): BoardCoord[] {
  const inner = range + 1;
  const outer = range + ringWidth;
  const tiles: BoardCoord[] = [];
  for (let dy = -outer; dy <= outer; dy++) {
    for (let dx = -outer; dx <= outer; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (dist >= inner && dist <= outer) {
        tiles.push({ x: origin.x + dx, y: origin.y + dy });
      }
    }
  }
  return tiles;
}

export function wallTiles(
  origin: BoardCoord,
  size: number,
  direction: PatternDirection,
  lopsidedExtra: "left" | "right" = "right",
): BoardCoord[] {
  const lateral = PERP_DELTA[direction];
  const leftCount = size % 2 === 0 && lopsidedExtra === "left" ? size : Math.floor(size / 2);
  const rightCount = size % 2 === 0 && lopsidedExtra === "right" ? size : Math.ceil(size / 2);
  const tiles: BoardCoord[] = [origin];

  for (let i = 1; i <= leftCount; i++) {
    tiles.push({
      x: origin.x - lateral.x * i,
      y: origin.y - lateral.y * i,
    });
  }
  for (let i = 1; i <= rightCount; i++) {
    tiles.push({
      x: origin.x + lateral.x * i,
      y: origin.y + lateral.y * i,
    });
  }
  return tiles;
}

export function baseFixedPatternTiles(
  patternId: string,
  origin: BoardCoord,
  size: number,
  direction: PatternDirection,
  options?: PatternTileOptions,
): BoardCoord[] {
  const ringGap = options?.ringGap ?? 1;
  const lopsidedExtra = options?.lopsidedExtra ?? "right";

  switch (patternId) {
    case "burst":
      return burstTiles(origin, size);
    case "blast":
      return blastTiles(origin, size, direction);
    case "line":
      return lineTiles(origin, size, direction);
    case "charge":
      return chargeTiles(origin, size, direction);
    case "cone":
      return coneTiles(origin, size, direction);
    case "star":
      return starTiles(origin, size);
    case "ring":
      return ringTiles(origin, size, ringGap);
    case "wall":
      return wallTiles(origin, size, direction, lopsidedExtra);
    default:
      return [];
  }
}

export function fixedPatternTiles(
  patternId: string,
  origin: BoardCoord,
  size: number,
  direction: PatternDirection,
  options?: PatternTileOptions,
): BoardCoord[] {
  const modifiers = options?.modifiers;
  const lopsidedExtra = options?.lopsidedExtra ?? "right";

  if (!modifiers) {
    return baseFixedPatternTiles(patternId, origin, size, direction, options);
  }

  const rangeMod = modifiers.range;
  const widthMod = modifiers.width;

  if (!patternId && rangeMod > 0) {
    return rangeOnlyTiles(origin, rangeMod);
  }

  if (patternId === "ring") {
    const ringGap = rangeMod > 0 ? rangeMod : (options?.ringGap ?? 1);
    return ringTiles(origin, size, ringGap);
  }

  let patternOrigin = origin;
  if (rangeMod > 0 && patternId !== "burst" && patternId !== "star") {
    patternOrigin = offsetOrigin(origin, direction, rangeMod);
  }

  if (widthMod > 0 && (patternId === "line" || patternId === "charge")) {
    return lineTilesWithWidth(
      patternOrigin,
      size,
      widthMod,
      direction,
      lopsidedExtra,
    );
  }

  if (widthMod > 0 && patternId === "cone") {
    const tiles: BoardCoord[] = [];
    for (let w = -Math.floor((widthMod - 1) / 2); w <= Math.ceil((widthMod - 1) / 2); w++) {
      const shifted = {
        x: patternOrigin.x + PERP_DELTA[direction].x * w,
        y: patternOrigin.y + PERP_DELTA[direction].y * w,
      };
      tiles.push(...coneTiles(shifted, size, direction));
    }
    return tiles;
  }

  return baseFixedPatternTiles(
    patternId,
    patternOrigin,
    size,
    direction,
    {
      ...options,
      ringGap: options?.ringGap,
    },
  );
}

export function patternPreviewTiles(
  patternId: string | null,
  origin: BoardCoord,
  size: number,
  direction: PatternDirection,
  options?: PatternTileOptions,
): BoardCoord[] {
  const modifiers = options?.modifiers;
  if (!patternId) {
    if (modifiers && modifiers.range > 0) return rangeOnlyTiles(origin, modifiers.range);
    return [];
  }
  return fixedPatternTiles(patternId, origin, size, direction, options);
}

export function fixedPatternTilesInBounds(
  patternId: string,
  origin: BoardCoord,
  size: number,
  direction: PatternDirection,
  width: number,
  height: number,
  options?: PatternTileOptions,
): BoardCoord[] {
  return filterInBounds(
    fixedPatternTiles(patternId, origin, size, direction, options),
    width,
    height,
  );
}

export function recoilTilesInBounds(
  origin: BoardCoord,
  recoil: number,
  direction: PatternDirection,
  width: number,
  height: number,
): BoardCoord[] {
  return filterInBounds(recoilTiles(origin, recoil, direction), width, height);
}

export function isOrthogonallyAdjacent(a: BoardCoord, b: BoardCoord): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function isDiagonallyAdjacent(a: BoardCoord, b: BoardCoord): boolean {
  return Math.abs(a.x - b.x) === 1 && Math.abs(a.y - b.y) === 1;
}

export function isMovementStepAdjacent(
  from: BoardCoord,
  to: BoardCoord,
  allowDiagonal: boolean,
): boolean {
  if (isOrthogonallyAdjacent(from, to)) return true;
  return allowDiagonal && isDiagonallyAdjacent(from, to);
}

export function drawableExpansionOptions(
  drawn: BoardCoord[],
  size: number,
  width: number,
  height: number,
): BoardCoord[] {
  if (drawn.length === 0 || drawn.length >= size) return [];

  const selected = new Set(drawn.map((c) => coordKey(c.x, c.y)));
  const options: BoardCoord[] = [];
  const seen = new Set<string>();

  for (const tile of drawn) {
    for (const d of ["n", "e", "s", "w"] as PatternDirection[]) {
      const delta = DIR_DELTA[d];
      const next = { x: tile.x + delta.x, y: tile.y + delta.y };
      const key = coordKey(next.x, next.y);
      if (!inBounds(next, width, height) || selected.has(key) || seen.has(key)) continue;
      seen.add(key);
      options.push(next);
    }
  }
  return options;
}

export function hasBlobHole(tiles: BoardCoord[]): boolean {
  if (tiles.length === 0) return false;
  const affected = new Set(tiles.map((c) => coordKey(c.x, c.y)));
  const minX = Math.min(...tiles.map((c) => c.x));
  const maxX = Math.max(...tiles.map((c) => c.x));
  const minY = Math.min(...tiles.map((c) => c.y));
  const maxY = Math.max(...tiles.map((c) => c.y));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const key = coordKey(x, y);
      if (affected.has(key)) continue;
      const surrounded =
        affected.has(coordKey(x - 1, y)) &&
        affected.has(coordKey(x + 1, y)) &&
        affected.has(coordKey(x, y - 1)) &&
        affected.has(coordKey(x, y + 1));
      if (surrounded) return true;
    }
  }
  return false;
}

export function arcPathLength(path: BoardCoord[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y);
  }
  return total;
}

export function canExtendArc(
  path: BoardCoord[],
  next: BoardCoord,
  maxLength: number,
): boolean {
  if (path.length === 0) return true;
  const last = path[path.length - 1];
  if (!isOrthogonallyAdjacent(last, next)) return false;
  const nextPath = [...path, next];
  return arcPathLength(nextPath) <= maxLength;
}

export function coordsToKeySet(coords: BoardCoord[]): Set<string> {
  return new Set(coords.map((c) => coordKey(c.x, c.y)));
}

export function chebyshevDistFrom(origin: BoardCoord, coord: BoardCoord): number {
  return chebyshevDistance(origin, coord);
}

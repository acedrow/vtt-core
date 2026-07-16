import type { PatternDirection } from "./pattern-data.js";
import type { AttackRangeSpan, RelativeTile, WeaponAttackSpec } from "./combat/types.js";
import { coordKey } from "./map.js";
import type { GameState } from "./types.js";

export type PatternGridCell = "empty" | "origin" | "attack" | "heal";

export type PatternGrid = {
  minX: number;
  minY: number;
  width: number;
  height: number;
  cells: PatternGridCell[][];
};

export function rotateRelativeTile(
  [rx, ry]: RelativeTile,
  direction: PatternDirection,
): [number, number] {
  switch (direction) {
    case "e":
      return [rx, ry];
    case "n":
      return [ry, -rx];
    case "s":
      return [-ry, rx];
    case "w":
      return [-rx, -ry];
  }
}

export function bespokeTilesInBounds(
  origin: { x: number; y: number },
  tiles: RelativeTile[],
  direction: PatternDirection,
  boardWidth: number,
  boardHeight: number,
): { x: number; y: number }[] {
  const seen = new Set<string>();
  const result: { x: number; y: number }[] = [];
  for (const tile of tiles) {
    const [dx, dy] = rotateRelativeTile(tile, direction);
    const x = origin.x + dx;
    const y = origin.y + dy;
    if (x < 0 || y < 0 || x >= boardWidth || y >= boardHeight) continue;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ x, y });
  }
  return result;
}

export function attackSpecHasDiagram(spec: WeaponAttackSpec): boolean {
  return !!(
    spec.tiles?.length ||
    spec.levels?.length ||
    spec.bombs?.length ||
    spec.rangeTargets
  );
}

export function buildPatternGrid(
  tiles: RelativeTile[],
  options?: {
    healTiles?: RelativeTile[];
    boundsTiles?: RelativeTile[];
    showOrigin?: boolean;
  },
): PatternGrid {
  const showOrigin = options?.showOrigin ?? true;
  const healKeys = new Set((options?.healTiles ?? []).map((t) => `${t[0]},${t[1]}`));
  const attackKeys = new Set(tiles.map((t) => `${t[0]},${t[1]}`));

  let minX = showOrigin ? 0 : Infinity;
  let maxX = showOrigin ? 0 : -Infinity;
  let minY = showOrigin ? 0 : Infinity;
  let maxY = showOrigin ? 0 : -Infinity;

  const mark = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };

  if (showOrigin) mark(0, 0);
  for (const [x, y] of tiles) mark(x, y);
  for (const [x, y] of options?.healTiles ?? []) mark(x, y);
  for (const [x, y] of options?.boundsTiles ?? []) mark(x, y);

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, width: 1, height: 1, cells: [["empty"]] };
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const cells: PatternGridCell[][] = [];
  for (let row = 0; row < height; row++) {
    const line: PatternGridCell[] = [];
    for (let col = 0; col < width; col++) {
      const x = minX + col;
      const y = minY + row;
      const key = `${x},${y}`;
      if (showOrigin && x === 0 && y === 0) {
        line.push("origin");
      } else if (healKeys.has(key)) {
        line.push("heal");
      } else if (attackKeys.has(key)) {
        line.push("attack");
      } else {
        line.push("empty");
      }
    }
    cells.push(line);
  }

  return { minX, minY, width, height, cells };
}

export function formatWeaponPatternSummary(spec: WeaponAttackSpec): string {
  if (spec.rangeTargets) {
    return `Up to ${spec.rangeTargets.maxTargets} targets within Range:${spec.rangeTargets.range}`;
  }
  if (spec.tiles?.length) {
    return `${spec.tiles.length}-tile pattern`;
  }
  if (spec.patternId && spec.size != null) {
    const parts = [`${spec.patternId}:${spec.size}`];
    if (spec.range) parts.push(`range ${spec.range}`);
    if (spec.width && spec.width > 1) parts.push(`width ${spec.width}`);
    return parts.join(", ");
  }
  return "Variable pattern";
}

export function isRangeTargetAttack(spec: WeaponAttackSpec): boolean {
  return !!(spec.rangeTargets || (spec.patternId === "range" && spec.range));
}

export function parseAttackRangeSpan(value: number | string | undefined): AttackRangeSpan | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    return value > 0 ? { min: 1, max: value } : null;
  }
  const parts = String(value).split("-").map((part) => Number(part.trim()));
  if (parts.some((n) => !Number.isFinite(n) || n < 1)) return null;
  if (parts.length === 1) return { min: 1, max: parts[0]! };
  return { min: Math.min(parts[0]!, parts[1]!), max: Math.max(parts[0]!, parts[1]!) };
}

export function isHealAttackSpec(spec: WeaponAttackSpec): boolean {
  return !!(spec.heal || spec.effects?.some((effect) => effect.startsWith("Healing")));
}

export function usesAnchoredPatternPlacement(spec: WeaponAttackSpec): boolean {
  return !!(spec.tiles?.length && spec.rangeSpan);
}

function tileManhattanDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export type AnchoredPatternPlacement = {
  patternTiles: { x: number; y: number }[];
  patternOrigin: { x: number; y: number };
  nearestEmptySpaces: number;
  tooCloseKeys: Set<string>;
  tooFar: boolean;
  valid: boolean;
};

export function evaluateAnchoredPatternPlacement(
  user: { x: number; y: number },
  anchor: { x: number; y: number },
  spec: WeaponAttackSpec,
  direction: PatternDirection,
  state: GameState,
): AnchoredPatternPlacement {
  const patternOrigin = patternOriginFromAnchor(anchor, spec.anchorTile, direction);
  const patternTiles = bespokeTilesInBounds(
    patternOrigin,
    spec.tiles!,
    direction,
    state.width,
    state.height,
  );
  const span = spec.rangeSpan!;
  let nearestDist = Infinity;
  const tooCloseKeys = new Set<string>();

  for (const tile of patternTiles) {
    const dist = tileManhattanDistance(user, tile);
    nearestDist = Math.min(nearestDist, dist);
    if (dist - 1 < span.min) {
      tooCloseKeys.add(coordKey(tile.x, tile.y));
    }
  }

  const nearestEmptySpaces = nearestDist === Infinity ? Infinity : nearestDist - 1;
  const tooFar = nearestEmptySpaces > span.max;
  const valid = patternTiles.length > 0 && !tooFar && tooCloseKeys.size === 0;

  return {
    patternTiles,
    patternOrigin,
    nearestEmptySpaces,
    tooCloseKeys,
    tooFar,
    valid,
  };
}

export function patternOriginFromAnchor(
  anchor: { x: number; y: number },
  anchorTile: RelativeTile | undefined,
  direction: PatternDirection,
): { x: number; y: number } {
  const [dx, dy] = rotateRelativeTile(anchorTile ?? [0, 0], direction);
  return { x: anchor.x - dx, y: anchor.y - dy };
}

export function isRangedPatternAttack(spec: WeaponAttackSpec): boolean {
  if (isRangeTargetAttack(spec)) return false;
  const hasPattern = !!(spec.tiles?.length || (spec.patternId && spec.size != null));
  if (!hasPattern) return false;
  if (spec.rangeSpan) return true;
  return !!(spec.patternId && spec.size != null && spec.range != null && spec.range > 0);
}

export function rangedPatternPlacementKeys(
  state: GameState,
  origin: { x: number; y: number },
  span: AttackRangeSpan,
): Set<string> {
  const keys = new Set<string>();
  for (let dy = -span.max; dy <= span.max; dy++) {
    for (let dx = -span.max; dx <= span.max; dx++) {
      if (dx === 0 && dy === 0) continue;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < span.min || dist > span.max) continue;
      const x = origin.x + dx;
      const y = origin.y + dy;
      if (x < 0 || y < 0 || x >= state.width || y >= state.height) continue;
      keys.add(coordKey(x, y));
    }
  }
  return keys;
}

export function rangeTargetDistance(spec: WeaponAttackSpec): number {
  return spec.rangeTargets?.range ?? spec.range ?? 1;
}

export function rangeTargetMax(spec: WeaponAttackSpec): number {
  return spec.rangeTargets?.maxTargets ?? 1;
}
